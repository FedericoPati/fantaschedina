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

    const { searchParams } = new URL(request.url);

    const roundIdParam =
      searchParams.get("round_id");

    /*
     * Se player_id non viene specificato,
     * significa "i miei pronostici".
     *
     * Dopo il lock sarà invece possibile
     * richiedere quelli di un altro player.
     */
    const requestedPlayerId =
      searchParams.get("player_id");

    const targetPlayerId =
      requestedPlayerId ?? user.id;

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
      data: round,
      error: roundError,
    } = await supabase
      .from("rounds")
      .select(
        "id, locked, first_match_start"
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
        { error: "Round has no start time" },
        { status: 500 }
      );
    }

    const isLocked =
      round.locked ||
      new Date() >=
        new Date(round.first_match_start);

    /*
     * Prima del lock puoi leggere
     * solamente i TUOI pronostici.
     *
     * user.id arriva dalla sessione:
     * non può essere falsificato dalla UI.
     */
    if (
      !isLocked &&
      targetPlayerId !== user.id
    ) {
      return NextResponse.json(
        {
          error:
            "Other players' predictions are hidden until the round is locked",
        },
        { status: 403 }
      );
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

    if (!matches || matches.length === 0) {
      return NextResponse.json({
        success: true,
        locked: isLocked,
        predictions: [],
      });
    }

    const matchIds = matches.map(
      (match) => match.id
    );

    const {
      data: predictions,
      error: predictionsError,
    } = await supabase
      .from("predictions")
      .select(
        "id, player_id, match_id, home_score, away_score, points, created_at, updated_at"
      )
      .eq("player_id", targetPlayerId)
      .in("match_id", matchIds);

    if (predictionsError) {
      throw predictionsError;
    }

    return NextResponse.json({
      success: true,
      locked: isLocked,
      predictions: predictions ?? [],
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

export async function POST(request: Request) {
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

    const body = await request.json();

    const { predictions } = body;

    if (!Array.isArray(predictions)) {
      return NextResponse.json(
        { error: "Invalid prediction data" },
        { status: 400 }
      );
    }

    if (predictions.length !== 10) {
      return NextResponse.json(
        {
          error:
            "A complete round must contain exactly 10 predictions",
        },
        { status: 400 }
      );
    }

    for (const prediction of predictions) {
      if (
        !Number.isInteger(
          prediction.match_id
        ) ||
        !Number.isInteger(
          prediction.home_score
        ) ||
        !Number.isInteger(
          prediction.away_score
        ) ||
        prediction.home_score < 0 ||
        prediction.away_score < 0 ||
        prediction.home_score > 20 ||
        prediction.away_score > 20
      ) {
        return NextResponse.json(
          { error: "Invalid prediction data" },
          { status: 400 }
        );
      }
    }

    /*
     * Verifica che l'utente autenticato
     * abbia realmente un player.
     */
    const {
      data: player,
      error: playerError,
    } = await supabase
      .from("players")
      .select("id")
      .eq("id", user.id)
      .single();

    if (playerError || !player) {
      return NextResponse.json(
        { error: "Player not found" },
        { status: 404 }
      );
    }

    const matchIds = predictions.map(
      (prediction) =>
        prediction.match_id
    );

    const {
      data: matches,
      error: matchesError,
    } = await supabase
      .from("matches")
      .select("id, round_id")
      .in("id", matchIds);

    if (matchesError) {
      throw matchesError;
    }

    if (
      !matches ||
      matches.length !== 10
    ) {
      return NextResponse.json(
        {
          error:
            "One or more matches were not found",
        },
        { status: 404 }
      );
    }

    const roundIds = [
      ...new Set(
        matches.map(
          (match) => match.round_id
        )
      ),
    ];

    if (roundIds.length !== 1) {
      return NextResponse.json(
        {
          error:
            "All predictions must belong to the same round",
        },
        { status: 400 }
      );
    }

    const roundId = roundIds[0];

    const {
      data: round,
      error: roundError,
    } = await supabase
      .from("rounds")
      .select(
        "id, locked, first_match_start"
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
        { error: "Round has no start time" },
        { status: 500 }
      );
    }

    const isLocked =
      round.locked ||
      new Date() >=
        new Date(round.first_match_start);

    if (isLocked) {
      return NextResponse.json(
        { error: "This round is locked" },
        { status: 403 }
      );
    }

    /*
     * IMPORTANTE:
     * player_id NON arriva più dal browser.
     * È sempre user.id della sessione.
     */
    const rows = predictions.map(
      (prediction) => ({
        player_id: user.id,
        match_id: prediction.match_id,
        home_score:
          prediction.home_score,
        away_score:
          prediction.away_score,
        updated_at:
          new Date().toISOString(),
      })
    );

    const { data, error } =
      await supabase
        .from("predictions")
        .upsert(rows, {
          onConflict:
            "player_id,match_id",
        })
        .select();

    if (error) {
      return NextResponse.json(
        {
          error:
            "Prediction save failed",
          details: error,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      predictions: data,
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