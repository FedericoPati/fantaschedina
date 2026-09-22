import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
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

    const { id } = await context.params;
    const roundId = Number(id);

    if (!Number.isInteger(roundId)) {
      return NextResponse.json(
        { error: "Invalid round id" },
        { status: 400 }
      );
    }

    const supabase = createClient(
      supabaseUrl,
      supabaseKey
    );

    // Recupera la giornata
    const { data: round, error: roundError } =
      await supabase
        .from("rounds")
        .select(
          "id, round_number, first_match_start, locked"
        )
        .eq("id", roundId)
        .single();

    if (roundError || !round) {
      return NextResponse.json(
        { error: "Round not found" },
        { status: 404 }
      );
    }

    // Il lock reale dipende anche dall'orario.
    const firstMatchStart = round.first_match_start
      ? new Date(round.first_match_start)
      : null;

    const locked =
      round.locked ||
      (firstMatchStart !== null &&
        new Date() >= firstMatchStart);

    // Recupera tutte le partite della giornata.
    const { data: matches, error: matchesError } =
      await supabase
        .from("matches")
        .select(
          "id, round_id, home_team, away_team, kickoff, home_score, away_score, status, external_id"
        )
        .eq("round_id", roundId)
        .order("kickoff", { ascending: true });

    if (matchesError) {
      throw matchesError;
    }

    return NextResponse.json({
      success: true,
      round: {
        ...round,
        locked,
      },
      matches: matches ?? [],
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
