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

    const roundId = Number(roundIdParam);

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
     * ciascun giocatore vede solo se stesso.
     */
    if (!isLocked) {
      return NextResponse.json({
        success: true,
        locked: false,
        players: [currentPlayer],
      });
    }

    /*
     * Dopo il lock:
     * tutti i giocatori registrati,
     * anche chi non ha fatto pronostici.
     */
    const {
      data: players,
      error: playersError,
    } = await supabase
      .from("players")
      .select("id, name")
      .order("name", {
        ascending: true,
      });

    if (playersError) {
      throw playersError;
    }

    /*
     * Mettiamo sempre l'utente corrente
     * come primo della lista.
     */
    const orderedPlayers = [
      ...(players ?? []),
    ].sort((a, b) => {
      if (a.id === user.id) return -1;
      if (b.id === user.id) return 1;

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