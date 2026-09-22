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

  const name = String(
    formData.get("name") ?? ""
  ).trim();

  const email = String(
    formData.get("email") ?? ""
  ).trim();

  const password = String(
    formData.get("password") ?? ""
  );

  if (!name || !email || !password) {
    return redirectTo(
      "/login?mode=signup&error=" +
        encodeURIComponent(
          "Compila tutti i campi."
        )
    );
  }

  if (password.length < 6) {
    return redirectTo(
      "/login?mode=signup&error=" +
        encodeURIComponent(
          "La password deve avere almeno 6 caratteri."
        )
    );
  }

  const supabase = await createClient();

  const { error } =
    await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
        },
      },
    });

  if (error) {
    return redirectTo(
      "/login?mode=signup&error=" +
        encodeURIComponent(error.message)
    );
  }

  return redirectTo("/");
}
