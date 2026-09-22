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

  const password = String(
    formData.get("password") ?? ""
  );

  if (!email || !password) {
    return redirectTo(
      "/login?error=" +
        encodeURIComponent(
          "Email e password sono obbligatorie."
        )
    );
  }

  const supabase = await createClient();

  const { error } =
    await supabase.auth.signInWithPassword({
      email,
      password,
    });

  if (error) {
    return redirectTo(
      "/login?error=" +
        encodeURIComponent(
          "Email o password non corretti."
        )
    );
  }

  return redirectTo("/");
}
