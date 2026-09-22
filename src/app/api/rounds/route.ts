import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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

    const { data: rounds, error } = await supabase
      .from("rounds")
      .select("id, round_number, first_match_start, locked")
      .order("round_number", { ascending: false });

    if (error) {
      throw error;
    }

    const now = new Date();

    const result = (rounds ?? []).map((round) => {
      const firstMatchStart = round.first_match_start
        ? new Date(round.first_match_start)
        : null;

      const locked =
        round.locked ||
        (firstMatchStart !== null &&
          now >= firstMatchStart);

      return {
        ...round,
        locked,
      };
    });

    return NextResponse.json({
      success: true,
      rounds: result,
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
