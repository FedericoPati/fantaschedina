import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function redirectTo(path: string) {
  return new NextResponse(null, {
    status: 303,
    headers: {
      Location: path,
    },
  });
}

export async function POST(request: Request) {
  const formData = await request.formData();

  const password = String(
    formData.get("password") ?? ""
  );

  const confirmPassword = String(
    formData.get("confirm_password") ?? ""
  );

  if (!password || !confirmPassword) {
    return redirectTo(
      "/reset-password?error=" +
        encodeURIComponent(
          "Compila entrambi i campi."
        )
    );
  }

  if (password.length < 6) {
    return redirectTo(
      "/reset-password?error=" +
        encodeURIComponent(
          "La password deve avere almeno 6 caratteri."
        )
    );
  }

  if (password !== confirmPassword) {
    return redirectTo(
      "/reset-password?error=" +
        encodeURIComponent(
          "Le password non coincidono."
        )
    );
  }

  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return redirectTo(
      "/login?error=" +
        encodeURIComponent(
          "Il link di recupero non è valido o è scaduto."
        )
    );
  }

  const { error } =
    await supabase.auth.updateUser({
      password,
    });

  if (error) {
    console.error(error);

    return redirectTo(
      "/reset-password?error=" +
        encodeURIComponent(
          "Non è stato possibile aggiornare la password."
        )
    );
  }

  /*
   * Dopo il cambio password facciamo uscire
   * l'utente e gli chiediamo di accedere
   * nuovamente con la nuova password.
   */
  await supabase.auth.signOut();

  return redirectTo(
    "/login?message=" +
      encodeURIComponent(
        "Password aggiornata. Ora puoi accedere con la nuova password."
      )
  );
}
