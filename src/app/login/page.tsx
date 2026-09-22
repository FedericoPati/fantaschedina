import Link from "next/link";

type LoginPageProps = {
  searchParams: Promise<{
    mode?: string;
    error?: string;
    message?: string;
  }>;
};

export default async function LoginPage({
  searchParams,
}: LoginPageProps) {
  const params = await searchParams;

  const isSignup = params.mode === "signup";

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f6f6f4] px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-gray-400">
            Serie A
          </p>

          <h1 className="text-4xl font-bold tracking-tight text-gray-950">
            Fantaschedina
          </h1>

          <p className="mt-3 text-sm text-gray-500">
            Pronostica. Indovina. Scala la classifica.
          </p>
        </div>

        <div className="rounded-3xl border border-black/5 bg-white p-6 shadow-sm sm:p-8">
          <div className="mb-7 grid grid-cols-2 rounded-xl bg-gray-100 p-1">
            <Link
              href="/login"
              className={`rounded-lg px-4 py-2.5 text-center text-sm font-semibold transition ${
                !isSignup
                  ? "bg-white text-gray-950 shadow-sm"
                  : "text-gray-500"
              }`}
            >
              Accedi
            </Link>

            <Link
              href="/login?mode=signup"
              className={`rounded-lg px-4 py-2.5 text-center text-sm font-semibold transition ${
                isSignup
                  ? "bg-white text-gray-950 shadow-sm"
                  : "text-gray-500"
              }`}
            >
              Registrati
            </Link>
          </div>

          <div className="mb-6">
            <h2 className="text-xl font-bold tracking-tight text-gray-950">
              {isSignup
                ? "Crea il tuo account"
                : "Bentornato"}
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              {isSignup
                ? "Entra nella Fantaschedina."
                : "Accedi con email o nome utente."}
            </p>
          </div>

          {params.error && (
            <div className="mb-5 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {params.error}
            </div>
          )}

          {params.message && (
            <div className="mb-5 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
              {params.message}
            </div>
          )}

          <form
            action={
              isSignup
                ? "/auth/signup"
                : "/auth/login"
            }
            method="post"
          >
            <div className="space-y-4">
              {isSignup && (
                <div>
                  <label
                    htmlFor="name"
                    className="mb-1.5 block text-sm font-medium text-gray-700"
                  >
                    Nome utente
                  </label>

                  <input
                    id="name"
                    name="name"
                    type="text"
                    autoComplete="username"
                    required
                    placeholder="Federico"
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-950 outline-none transition placeholder:text-gray-300 focus:border-gray-400 focus:bg-white"
                  />
                </div>
              )}

              <div>
                <label
                  htmlFor={
                    isSignup
                      ? "email"
                      : "identifier"
                  }
                  className="mb-1.5 block text-sm font-medium text-gray-700"
                >
                  {isSignup
                    ? "Email"
                    : "Email o nome utente"}
                </label>

                <input
                  id={
                    isSignup
                      ? "email"
                      : "identifier"
                  }
                  name={
                    isSignup
                      ? "email"
                      : "identifier"
                  }
                  type={
                    isSignup
                      ? "email"
                      : "text"
                  }
                  autoComplete={
                    isSignup
                      ? "email"
                      : "username"
                  }
                  required
                  placeholder={
                    isSignup
                      ? "nome@email.it"
                      : "Federico o nome@email.it"
                  }
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-950 outline-none transition placeholder:text-gray-300 focus:border-gray-400 focus:bg-white"
                />
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="mb-1.5 block text-sm font-medium text-gray-700"
                >
                  Password
                </label>

                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete={
                    isSignup
                      ? "new-password"
                      : "current-password"
                  }
                  required
                  minLength={6}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-950 outline-none transition placeholder:text-gray-300 focus:border-gray-400 focus:bg-white"
                />
              </div>
            </div>

            <button
              type="submit"
              className="mt-6 w-full rounded-xl bg-gray-950 px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-gray-800"
            >
              {isSignup
                ? "Crea account"
                : "Accedi"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}