import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { getSerieAMatches } from "@/app/lib/football-data";
import { scoreRound } from "@/app/lib/scoring";

/*
 * Questi status NON devono determinare
 * l'inizio della giornata.
 */
const DEFERRED_STATUSES = new Set([
  "POSTPONED",
  "SUSPENDED",
  "CANCELLED",
  "CANCELED",
]);

/*
 * Se almeno una partita ha raggiunto
 * uno di questi status, consideriamo
 * la giornata realmente iniziata.
 */
const STARTED_STATUSES = new Set([
  "IN_PLAY",
  "PAUSED",
  "FINISHED",
  "AWARDED",
]);

export async function GET(request: Request) {
  try {
    /*
     * -------------------------------------------------
     * AUTORIZZAZIONE
     * -------------------------------------------------
     */

    const authHeader =
      request.headers.get("authorization");

    const cronSecret =
      process.env.CRON_SECRET;

    if (!cronSecret) {
      return NextResponse.json(
        {
          error:
            "CRON_SECRET not configured",
        },
        { status: 500 }
      );
    }

    if (
      authHeader !==
      `Bearer ${cronSecret}`
    ) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    /*
     * -------------------------------------------------
     * CLIENT SUPABASE AMMINISTRATIVO
     * -------------------------------------------------
     */

    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL;

    const serviceRoleKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (
      !supabaseUrl ||
      !serviceRoleKey
    ) {
      return NextResponse.json(
        {
          error:
            "Missing server environment variables",
        },
        { status: 500 }
      );
    }

    const supabase = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

    /*
     * -------------------------------------------------
     * SMART SYNC
     *
     * GitHub può chiamarci ogni 5 minuti,
     * ma football-data viene interrogato
     * soltanto vicino alle partite.
     *
     * force=1 viene usato per il refresh
     * completo giornaliero.
     * -------------------------------------------------
     */

    const { searchParams } =
      new URL(request.url);

    const force =
      searchParams.get("force") === "1";

    if (!force) {
      const now = new Date();

      /*
       * Manteniamo una finestra abbastanza
       * larga da coprire una partita,
       * intervallo e possibili ritardi.
       */
      const windowStart = new Date(
        now.getTime() -
          5 * 60 * 60 * 1000
      );

      const windowEnd = new Date(
        now.getTime() +
          30 * 60 * 1000
      );

      const {
        data: possibleActiveMatches,
        error: activeMatchesError,
      } = await supabase
        .from("matches")
        .select("id, status")
        .gte(
          "kickoff",
          windowStart.toISOString()
        )
        .lte(
          "kickoff",
          windowEnd.toISOString()
        );

      if (activeMatchesError) {
        throw activeMatchesError;
      }

      /*
       * Una partita rinviata/cancellata
       * non deve provocare chiamate continue
       * a football-data.
       */
      const hasActiveMatch =
        (
          possibleActiveMatches ?? []
        ).some(
          (match) =>
            match.status !==
              "FINISHED" &&
            !DEFERRED_STATUSES.has(
              match.status
            )
        );

      if (!hasActiveMatch) {
        return NextResponse.json({
          success: true,
          skipped: true,
          reason:
            "No matches in the active sync window",
        });
      }
    }

    /*
     * -------------------------------------------------
     * FOOTBALL-DATA
     * -------------------------------------------------
     */

    const matches =
      await getSerieAMatches();

    if (matches.length === 0) {
      return NextResponse.json({
        success: true,
        api_matches: 0,
        synced_matches: 0,

        scoring: {
          scored_rounds: 0,
          evaluated_predictions: 0,
          updated_predictions: 0,
        },
      });
    }

    /*
     * -------------------------------------------------
     * RECUPERA LO STATO ATTUALE DELLE GIORNATE
     * -------------------------------------------------
     */

    const {
      data: existingRounds,
      error: existingRoundsError,
    } = await supabase
      .from("rounds")
      .select(
        "id, round_number, first_match_start, locked"
      );

    if (existingRoundsError) {
      throw existingRoundsError;
    }

    const existingRoundByNumber =
      new Map<
        number,
        {
          id: number;
          round_number: number;
          first_match_start:
            | string
            | null;
          locked: boolean;
        }
      >();

    for (
      const round
      of existingRounds ?? []
    ) {
      existingRoundByNumber.set(
        round.round_number,
        round
      );
    }

    /*
     * -------------------------------------------------
     * RAGGRUPPA LE PARTITE PER GIORNATA
     * -------------------------------------------------
     */

    const matchesByRound =
      new Map<
        number,
        typeof matches
      >();

    for (const match of matches) {
      if (match.matchday === null) {
        continue;
      }

      const current =
        matchesByRound.get(
          match.matchday
        ) ?? [];

      current.push(match);

      matchesByRound.set(
        match.matchday,
        current
      );
    }

    /*
     * -------------------------------------------------
     * CALCOLO first_match_start
     *
     * Qui avviene la gestione dei rinvii.
     * -------------------------------------------------
     */

    const roundRows: {
      round_number: number;
      first_match_start: string;
      locked: boolean;
    }[] = [];

    for (
      const [
        roundNumber,
        roundMatches,
      ] of matchesByRound
    ) {
      const existingRound =
        existingRoundByNumber.get(
          roundNumber
        );

      /*
       * Una giornata è realmente iniziata
       * solo se almeno una partita è stata
       * effettivamente giocata/iniziata.
       *
       * Non basta che il vecchio orario
       * sia passato, perché quella partita
       * potrebbe essere stata rinviata.
       */
      const actuallyStarted =
        roundMatches.some((match) =>
          STARTED_STATUSES.has(
            match.status
          )
        );

      /*
       * Escludiamo rinviate, sospese
       * e cancellate dal calcolo
       * dell'inizio della giornata.
       */
      const playableMatches =
        roundMatches.filter(
          (match) =>
            !DEFERRED_STATUSES.has(
              match.status
            )
        );

      const candidateStarts =
        playableMatches
          .map(
            (match) =>
              match.utcDate
          )
          .filter(Boolean)
          .sort(
            (a, b) =>
              new Date(a).getTime() -
              new Date(b).getTime()
          );

      let firstMatchStart =
        candidateStarts[0];

      /*
       * Caso estremamente raro:
       * tutte e 10 le partite risultano
       * temporaneamente rinviate.
       *
       * Manteniamo il valore precedente
       * finché football-data non comunica
       * le nuove date.
       */
      if (!firstMatchStart) {
        firstMatchStart =
          existingRound
            ?.first_match_start ??
          roundMatches
            .map(
              (match) =>
                match.utcDate
            )
            .sort(
              (a, b) =>
                new Date(a).getTime() -
                new Date(b).getTime()
            )[0];
      }

      if (!firstMatchStart) {
        continue;
      }

      /*
       * Una volta realmente iniziata,
       * la giornata resta bloccata.
       *
       * Se era già locked nel DB,
       * ovviamente rimane tale.
       */
      const locked =
        Boolean(
          existingRound?.locked
        ) || actuallyStarted;

      roundRows.push({
        round_number:
          roundNumber,

        first_match_start:
          firstMatchStart,

        locked,
      });
    }

    /*
     * -------------------------------------------------
     * AGGIORNA LE GIORNATE
     * -------------------------------------------------
     */

    const {
      data: rounds,
      error: roundsError,
    } = await supabase
      .from("rounds")
      .upsert(roundRows, {
        onConflict: "round_number",
        ignoreDuplicates: false,
      })
      .select();

    if (roundsError) {
      throw roundsError;
    }

    if (!rounds) {
      throw new Error(
        "Rounds upsert returned no data"
      );
    }

    const roundIdByNumber =
      new Map<number, number>();

    for (const round of rounds) {
      roundIdByNumber.set(
        round.round_number,
        round.id
      );
    }

    /*
     * -------------------------------------------------
     * PREPARA LE PARTITE
     * -------------------------------------------------
     */

    const matchRows = matches
      .filter(
        (match) =>
          match.matchday !== null
      )
      .map((match) => {
        const roundId =
          roundIdByNumber.get(
            match.matchday!
          );

        if (!roundId) {
          throw new Error(
            `Round ${match.matchday} not found for match ${match.id}`
          );
        }

        return {
          round_id: roundId,

          external_id:
            String(match.id),

          home_team:
            match.homeTeam.name,

          away_team:
            match.awayTeam.name,

          kickoff:
            match.utcDate,

          home_score:
            match.score.fullTime.home,

          away_score:
            match.score.fullTime.away,

          status:
            match.status,
        };
      });

    /*
     * -------------------------------------------------
     * AGGIORNA LE PARTITE
     * -------------------------------------------------
     */

    const {
      data: syncedMatches,
      error: matchesError,
    } = await supabase
      .from("matches")
      .upsert(matchRows, {
        onConflict:
          "external_id",

        ignoreDuplicates: false,
      })
      .select();

    if (matchesError) {
      throw matchesError;
    }

    /*
     * -------------------------------------------------
     * SCORING
     * -------------------------------------------------
     */

    const roundIdsToScore = [
      ...new Set(
        (syncedMatches ?? [])
          .filter(
            (match) =>
              match.status ===
                "FINISHED" &&
              match.home_score !==
                null &&
              match.away_score !==
                null
          )
          .map(
            (match) =>
              match.round_id
          )
      ),
    ];

    let scoredRounds = 0;

    let evaluatedPredictions = 0;

    let updatedPredictions = 0;

    for (
      const roundId
      of roundIdsToScore
    ) {
      const scoreResult =
        await scoreRound(
          supabase,
          roundId
        );

      scoredRounds++;

      evaluatedPredictions +=
        scoreResult
          .evaluated_predictions;

      updatedPredictions +=
        scoreResult
          .updated_predictions;
    }

    return NextResponse.json({
      success: true,

      api_matches:
        matches.length,

      rounds_synced:
        rounds.length,

      synced_matches:
        syncedMatches?.length ?? 0,

      scoring: {
        scored_rounds:
          scoredRounds,

        evaluated_predictions:
          evaluatedPredictions,

        updated_predictions:
          updatedPredictions,
      },
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        error:
          "Unexpected error",

        details:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 }
    );
  }
}