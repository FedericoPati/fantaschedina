import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
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
     * Recuperiamo le giornate in ordine.
     *
     * Non filtriamo più con:
     *
     *   .eq("locked", false)
     *
     * perché lo stato reale di lock viene determinato
     * confrontando l'orario attuale con first_match_start.
     */
    const { data: rounds, error: roundsError } =
      await supabase
        .from("rounds")
        .select("*")
        .order("round_number", { ascending: true });

    if (roundsError) {
      throw roundsError;
    }

    if (!rounds || rounds.length === 0) {
      return NextResponse.json({
        round: null,
        matches: [],
      });
    }

    const now = new Date();

    /*
     * Per ora manteniamo la giornata più recente disponibile.
     *
     * Se esiste una giornata futura/non iniziata,
     * prendiamo la prima.
     *
     * Altrimenti prendiamo l'ultima giornata esistente.
     *
     * Questo ci permette di continuare a visualizzare una
     * giornata anche dopo che è iniziata, cosa fondamentale
     * per mostrare risultati e punti.
     */
    const upcomingRound = rounds.find((round) => {
      if (!round.first_match_start) {
        return false;
      }

      return new Date(round.first_match_start) > now;
    });

    const round =
      upcomingRound ?? rounds[rounds.length - 1];

    const locked =
      Boolean(round.first_match_start) &&
      now >= new Date(round.first_match_start);

    const { data: matches, error: matchesError } =
      await supabase
        .from("matches")
        .select("*")
        .eq("round_id", round.id)
        .order("kickoff", { ascending: true });

    if (matchesError) {
      throw matchesError;
    }

    return NextResponse.json({
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