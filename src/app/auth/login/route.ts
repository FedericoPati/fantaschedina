import { NextResponse } from "next/server";
import {
  createClient as createAdminClient,
} from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";

function redirectTo(path: string) {
  return new NextResponse(null, {
    status: 303,
    headers: {
      Location: path,
    },
  });
}

function loginError() {
  return redirectTo(
    "/login?error=" +
      encodeURIComponent(
        "Email/nome utente o password non corretti."
      )
  );
}

export async function POST(request: Request) {
  const formData = await request.formData();

  const identifier = String(
    formData.get("identifier") ?? ""
  ).trim();

  const password = String(
    formData.get("password") ?? ""
  );

  if (!identifier || !password) {
    return redirectTo(
      "/login?error=" +
        encodeURIComponent(
          "Inserisci email o nome utente e password."
        )
    );
  }

  let email = identifier;

  /*
   * Se non contiene @ consideriamo
   * l'identificatore un nome utente.
   */
  if (!identifier.includes("@")) {
    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL;

    const serviceRoleKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      console.error(
        "Missing Supabase admin environment variables"
      );

      return redirectTo(
        "/login?error=" +
          encodeURIComponent(
            "Errore temporaneo di accesso."
          )
      );
    }

    const admin = createAdminClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

    /*
     * Cerchiamo il player tramite nome.
     * ilike permette Federico / federico.
     */
    const {
      data: player,
      error: playerError,
    } = await admin
      .from("players")
      .select("id")
      .ilike("name", identifier)
      .maybeSingle();

    if (playerError || !player) {
      return loginError();
    }

    /*
     * players.id corrisponde ad auth.users.id.
     * Recuperiamo quindi internamente l'email.
     *
     * L'email NON viene mai inviata al browser.
     */
    const {
      data: authData,
      error: authUserError,
    } =
      await admin.auth.admin.getUserById(
        player.id
      );

    const userEmail =
      authData.user?.email;

    if (authUserError || !userEmail) {
      return loginError();
    }

    email = userEmail;
  }

  const supabase = await createClient();

  const { error } =
    await supabase.auth.signInWithPassword({
      email,
      password,
    });

  if (error) {
    return loginError();
  }

  return redirectTo("/");
}