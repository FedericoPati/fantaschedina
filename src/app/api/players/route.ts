import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } =
      new URL(request.url);

    const roundIdParam =
      searchParams.get("round_id");

    if (!roundIdParam) {
      return NextResponse.json(
        { error: "round_id is required" },
        { status: 400 }
      );
    }

    const roundId =
      Number(roundIdParam);

    if (!Number.isInteger(roundId)) {
      return NextResponse.json(
        { error: "Invalid round_id" },
        { status: 400 }
      );
    }

    const {
      data: currentPlayer,
      error: playerError,
    } = await supabase
      .from("players")
      .select("id, name")
      .eq("id", user.id)
      .single();

    if (playerError || !currentPlayer) {
      return NextResponse.json(
        { error: "Player not found" },
        { status: 404 }
      );
    }

    const {
      data: round,
      error: roundError,
    } = await supabase
      .from("rounds")
      .select(
        "id, first_match_start, locked"
      )
      .eq("id", roundId)
      .single();

    if (roundError || !round) {
      return NextResponse.json(
        { error: "Round not found" },
        { status: 404 }
      );
    }

    if (!round.first_match_start) {
      return NextResponse.json(
        {
          error:
            "Round has no start time",
        },
        { status: 500 }
      );
    }

    const isLocked =
      round.locked ||
      new Date() >=
        new Date(round.first_match_start);

    /*
     * Prima del lock:
     * solo il giocatore loggato.
     */
    if (!isLocked) {
      return NextResponse.json({
        success: true,
        locked: false,
        players: [currentPlayer],
      });
    }

    const {
      data: matches,
      error: matchesError,
    } = await supabase
      .from("matches")
      .select("id")
      .eq("round_id", roundId);

    if (matchesError) {
      throw matchesError;
    }

    const matchIds = (
      matches ?? []
    ).map((match) => match.id);

    if (matchIds.length === 0) {
      return NextResponse.json({
        success: true,
        locked: true,
        players: [currentPlayer],
      });
    }

    const {
      data: predictions,
      error: predictionsError,
    } = await supabase
      .from("predictions")
      .select("player_id")
      .in("match_id", matchIds);

    if (predictionsError) {
      throw predictionsError;
    }

    /*
     * Includiamo sempre anche l'utente
     * corrente, anche se quella giornata
     * non aveva giocato.
     */
    const playerIds = [
      ...new Set([
        user.id,
        ...(predictions ?? []).map(
          (prediction) =>
            prediction.player_id
        ),
      ]),
    ];

    const {
      data: players,
      error: playersError,
    } = await supabase
      .from("players")
      .select("id, name")
      .in("id", playerIds);

    if (playersError) {
      throw playersError;
    }

    const orderedPlayers = [
      ...(players ?? []),
    ].sort((a, b) => {
      if (a.id === user.id) {
        return -1;
      }

      if (b.id === user.id) {
        return 1;
      }

      return a.name.localeCompare(
        b.name,
        "it"
      );
    });

    return NextResponse.json({
      success: true,
      locked: true,
      players: orderedPlayers,
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