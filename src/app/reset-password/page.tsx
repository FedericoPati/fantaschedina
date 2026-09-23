import Link from "next/link";

type Props = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function ResetPasswordPage({
  searchParams,
}: Props) {
  const params = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f6f6f4] px-4 py-10">
      <div className="w-full max-w-md">
        <div className="rounded-3xl border border-black/5 bg-white p-6 shadow-sm sm:p-8">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-gray-400">
            Fantaschedina
          </p>

          <h1 className="text-2xl font-bold tracking-tight text-gray-950">
            Nuova password
          </h1>

          <p className="mt-2 text-sm text-gray-500">
            Scegli una nuova password per il tuo account.
          </p>

          {params.error && (
            <div className="mt-5 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {params.error}
            </div>
          )}

          <form
            action="/auth/update-password"
            method="post"
            className="mt-6"
          >
            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-sm font-medium text-gray-700"
              >
                Nuova password
              </label>

              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={6}
                required
                placeholder="••••••••"
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-950 outline-none transition placeholder:text-gray-300 focus:border-gray-400 focus:bg-white"
              />
            </div>

            <div className="mt-4">
              <label
                htmlFor="confirm_password"
                className="mb-1.5 block text-sm font-medium text-gray-700"
              >
                Conferma password
              </label>

              <input
                id="confirm_password"
                name="confirm_password"
                type="password"
                autoComplete="new-password"
                minLength={6}
                required
                placeholder="••••••••"
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-950 outline-none transition placeholder:text-gray-300 focus:border-gray-400 focus:bg-white"
              />
            </div>

            <button
              type="submit"
              className="mt-6 w-full rounded-xl bg-gray-950 px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-gray-800"
            >
              Aggiorna password
            </button>
          </form>

          <Link
            href="/login"
            className="mt-5 block text-center text-sm font-medium text-gray-500 transition hover:text-gray-950"
          >
            Torna al login
          </Link>
        </div>
      </div>
    </main>
  );
}
