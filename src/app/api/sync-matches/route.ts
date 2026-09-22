import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSerieAMatches } from "@/app/lib/football-data";
import { scoreRound } from "@/app/lib/scoring";

export async function GET(request: Request) {
  try {
    const authHeader =
      request.headers.get("authorization");

    const syncSecret =
      process.env.CRON_SECRET;

    if (!syncSecret) {
      return NextResponse.json(
        { error: "CRON_SECRET not configured" },
        { status: 500 }
      );
    }

    if (
      authHeader !== `Bearer ${syncSecret}`
    ) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

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

    /*
     * Client amministrativo.
     * Questa chiave esiste SOLO sul server.
     */
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

    // 1. Recupera Serie A da football-data.org
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
     * 2. Ricostruisce first_match_start
     * di ogni giornata.
     */
    const roundsMap = new Map<
      number,
      {
        round_number: number;
        first_match_start: string;
      }
    >();

    for (const match of matches) {
      if (match.matchday === null) {
        continue;
      }

      const existing =
        roundsMap.get(match.matchday);

      if (
        !existing ||
        new Date(match.utcDate) <
          new Date(
            existing.first_match_start
          )
      ) {
        roundsMap.set(
          match.matchday,
          {
            round_number:
              match.matchday,
            first_match_start:
              match.utcDate,
          }
        );
      }
    }

    const roundRows =
      Array.from(
        roundsMap.values()
      );

    /*
     * 3. Aggiorna le giornate.
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
     * 4. Prepara le partite.
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
            match.score.fullTime
              .home,

          away_score:
            match.score.fullTime
              .away,

          status:
            match.status,
        };
      });

    /*
     * 5. Aggiorna le partite.
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
     * 6. Individua le giornate
     * con almeno una partita conclusa.
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

    /*
     * 7. Calcola automaticamente
     * i punti.
     */
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
        syncedMatches?.length ??
        0,

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