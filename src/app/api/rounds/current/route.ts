import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const LIVE_STATUSES = new Set([
  "IN_PLAY",
  "PAUSED",
]);

const DEFERRED_STATUSES = new Set([
  "POSTPONED",
  "SUSPENDED",
  "CANCELLED",
  "CANCELED",
]);

export async function GET() {
  try {
    const supabase = await createClient();

    const [
      { data: rounds, error: roundsError },
      { data: matches, error: matchesError },
    ] = await Promise.all([
      supabase
        .from("rounds")
        .select(
          "id, round_number, first_match_start, locked"
        )
        .order("round_number", {
          ascending: true,
        }),

      supabase
        .from("matches")
        .select(
          "id, round_id, home_team, away_team, kickoff, home_score, away_score, status, external_id"
        )
        .order("kickoff", {
          ascending: true,
        }),
    ]);

    if (roundsError) {
      throw roundsError;
    }

    if (matchesError) {
      throw matchesError;
    }

    const now = new Date();

    /*
     * Calcoliamo il lock reale.
     */
    const normalizedRounds = (
      rounds ?? []
    ).map((round) => ({
      ...round,

      locked:
        round.locked ||
        Boolean(
          round.first_match_start &&
            now >=
              new Date(
                round.first_match_start
              )
        ),
    }));

    /*
     * Raggruppiamo le partite
     * per giornata.
     */
    const matchesByRound =
      new Map<
        number,
        NonNullable<typeof matches>
      >();

    for (const match of matches ?? []) {
      const current =
        matchesByRound.get(
          match.round_id
        ) ?? [];

      current.push(match);

      matchesByRound.set(
        match.round_id,
        current
      );
    }

    /*
     * CASO 1:
     * esiste una partita realmente live.
     *
     * Questo vale anche per un recupero
     * di una vecchia giornata.
     */
    const liveRounds = normalizedRounds
      .filter((round) => {
        const roundMatches =
          matchesByRound.get(round.id) ??
          [];

        return roundMatches.some(
          (match) =>
            LIVE_STATUSES.has(
              match.status
            )
        );
      })
      .sort(
        (a, b) =>
          b.round_number -
          a.round_number
      );

    let selectedRound =
      liveRounds[0] ?? null;

    /*
     * CASO 2:
     * nessuna partita live.
     *
     * Controlliamo l'ultima giornata
     * già iniziata.
     */
    if (!selectedRound) {
      const latestLockedRound = [
        ...normalizedRounds,
      ]
        .filter(
          (round) => round.locked
        )
        .sort(
          (a, b) =>
            b.round_number -
            a.round_number
        )[0];

      if (latestLockedRound) {
        const roundMatches =
          matchesByRound.get(
            latestLockedRound.id
          ) ?? [];

        /*
         * Una partita normale ancora
         * da giocare mantiene attiva
         * la giornata.
         *
         * POSTPONED / SUSPENDED /
         * CANCELLED invece no.
         */
        const hasRegularPendingMatch =
          roundMatches.some(
            (match) =>
              match.status !==
                "FINISHED" &&
              !DEFERRED_STATUSES.has(
                match.status
              )
          );

        if (hasRegularPendingMatch) {
          selectedRound =
            latestLockedRound;
        }
      }
    }

    /*
     * CASO 3:
     * la giornata precedente è
     * realmente conclusa.
     *
     * Passiamo alla prossima aperta.
     */
    if (!selectedRound) {
      selectedRound = [
        ...normalizedRounds,
      ]
        .filter(
          (round) => !round.locked
        )
        .sort(
          (a, b) =>
            a.round_number -
            b.round_number
        )[0] ?? null;
    }

    /*
     * Fallback:
     * campionato terminato.
     */
    if (!selectedRound) {
      selectedRound = [
        ...normalizedRounds,
      ]
        .filter(
          (round) => round.locked
        )
        .sort(
          (a, b) =>
            b.round_number -
            a.round_number
        )[0] ?? null;
    }

    return NextResponse.json({
      success: true,

      round: selectedRound,

      matches: selectedRound
        ? matchesByRound.get(
            selectedRound.id
          ) ?? []
        : [],
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