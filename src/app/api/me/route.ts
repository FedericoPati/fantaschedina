import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();

    /*
     * Recupera l'utente realmente autenticato
     * dalla sessione Supabase.
     */
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

    /*
     * players.id coincide con auth.users.id
     */
    const { data: player, error: playerError } =
      await supabase
        .from("players")
        .select("id, name")
        .eq("id", user.id)
        .single();

    if (playerError || !player) {
      return NextResponse.json(
        { error: "Player profile not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      player: {
        id: player.id,
        name: player.name,
      },
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
