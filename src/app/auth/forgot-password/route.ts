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

  const email = String(
    formData.get("email") ?? ""
  ).trim();

  if (!email) {
    return redirectTo(
      "/forgot-password?error=" +
        encodeURIComponent(
          "Inserisci la tua email."
        )
    );
  }

  const origin = new URL(request.url).origin;

  const supabase = await createClient();

  const { error } =
    await supabase.auth.resetPasswordForEmail(
      email,
      {
        redirectTo:
          `${origin}/auth/callback?next=/reset-password`,
      }
    );

  if (error) {
    console.error(error);

    return redirectTo(
      "/forgot-password?error=" +
        encodeURIComponent(
          "Non è stato possibile inviare l'email."
        )
    );
  }

  return redirectTo(
    "/forgot-password?message=" +
      encodeURIComponent(
        "Se l'email è registrata, riceverai un link per reimpostare la password."
      )
  );
}
