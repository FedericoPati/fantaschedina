import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type Standing = {
  player_id: string;
  name: string;
  total_points: number;
  exact_scores: number;
  correct_outcomes: number;
  recent_round_points: {
    round_id: number;
    round_number: number;
    points: number;
  }[];
};

export async function GET() {
  try {
    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL;

    const supabaseKey =
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { error: "Missing environment variables" },
        { status: 500 }
      );
    }

    const supabase = createClient(
      supabaseUrl,
      supabaseKey
    );

    /*
     * 1. Recupera giocatori e giornate.
     */
    const [
      { data: players, error: playersError },
      { data: rounds, error: roundsError },
    ] = await Promise.all([
      supabase
        .from("players")
        .select("id, name")
        .order("name", { ascending: true }),

      supabase
        .from("rounds")
        .select(
          "id, round_number, first_match_start, locked"
        )
        .order("round_number", {
          ascending: true,
        }),
    ]);

    if (playersError) {
      throw playersError;
    }

    if (roundsError) {
      throw roundsError;
    }

    const now = new Date();

    /*
     * Non ci fidiamo esclusivamente della colonna
     * locked: calcoliamo anche il lock temporale.
     */
    const lockedRounds = (rounds ?? []).filter(
      (round) => {
        if (round.locked) {
          return true;
        }

        if (!round.first_match_start) {
          return false;
        }

        return (
          now >=
          new Date(round.first_match_start)
        );
      }
    );

    const lockedRoundIds = new Set(
      lockedRounds.map((round) => round.id)
    );

    /*
     * Ultime 3 giornate chiuse:
     * es. G5, G4, G3.
     */
    const recentRounds = [
      ...lockedRounds,
    ]
      .sort(
        (a, b) =>
          b.round_number - a.round_number
      )
      .slice(0, 3)
      .map((round) => ({
        id: round.id,
        round_number: round.round_number,
      }));

    /*
     * 2. Recupera la relazione
     * match -> giornata.
     */
    const {
      data: matches,
      error: matchesError,
    } = await supabase
      .from("matches")
      .select("id, round_id");

    if (matchesError) {
      throw matchesError;
    }

    const matchRoundById = new Map<
      number,
      number
    >();

    for (const match of matches ?? []) {
      matchRoundById.set(
        match.id,
        match.round_id
      );
    }

    /*
     * 3. Recupera tutti i pronostici.
     */
    const {
      data: predictions,
      error: predictionsError,
    } = await supabase
      .from("predictions")
      .select(
        "player_id, match_id, points"
      );

    if (predictionsError) {
      throw predictionsError;
    }

    /*
     * 4. Prepara una riga classifica
     * per ogni player.
     */
    const standingsByPlayer =
      new Map<string, Standing>();

    for (const player of players ?? []) {
      standingsByPlayer.set(
        player.id,
        {
          player_id: player.id,
          name: player.name,
          total_points: 0,
          exact_scores: 0,
          correct_outcomes: 0,
          recent_round_points:
            recentRounds.map((round) => ({
              round_id: round.id,
              round_number:
                round.round_number,
              points: 0,
            })),
        }
      );
    }

    /*
     * 5. Aggrega i punti.
     *
     * Consideriamo soltanto pronostici
     * appartenenti a giornate già locked.
     */
    for (const prediction of
      predictions ?? []) {
      const standing =
        standingsByPlayer.get(
          prediction.player_id
        );

      if (!standing) {
        continue;
      }

      const roundId =
        matchRoundById.get(
          prediction.match_id
        );

      if (
        !roundId ||
        !lockedRoundIds.has(roundId)
      ) {
        continue;
      }

      const points =
        prediction.points ?? 0;

      standing.total_points += points;

      /*
       * 3 punti = risultato esatto.
       */
      if (points === 3) {
        standing.exact_scores++;
      }

      /*
       * 1 punto = esito 1/X/2 corretto,
       * ma risultato non esatto.
       */
      if (points === 1) {
        standing.correct_outcomes++;
      }

      const recentRound =
        standing.recent_round_points.find(
          (item) =>
            item.round_id === roundId
        );

      if (recentRound) {
        recentRound.points += points;
      }
    }

    /*
     * 6. Ordina per punti totali.
     *
     * Il nome serve solo a mantenere un ordine
     * stabile quando due utenti hanno lo stesso
     * punteggio.
     */
    const standings = Array.from(
      standingsByPlayer.values()
    ).sort((a, b) => {
      if (
        b.total_points !==
        a.total_points
      ) {
        return (
          b.total_points -
          a.total_points
        );
      }

      return a.name.localeCompare(
        b.name,
        "it"
      );
    });

    /*
     * 7. Assegna le posizioni.
     *
     * A parità di punti assegniamo
     * la stessa posizione.
     *
     * Esempio:
     * 1°, 2°, 2°, 4°
     */
    let previousPoints:
      | number
      | null = null;

    let previousPosition = 0;

    const rankedStandings =
      standings.map(
        (standing, index) => {
          let position: number;

          if (
            previousPoints !== null &&
            standing.total_points ===
              previousPoints
          ) {
            position =
              previousPosition;
          } else {
            position = index + 1;
          }

          previousPoints =
            standing.total_points;

          previousPosition = position;

          return {
            position,
            ...standing,
          };
        }
      );

    return NextResponse.json({
      success: true,
      recent_rounds: recentRounds,
      standings: rankedStandings,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 }
    );
  }
}