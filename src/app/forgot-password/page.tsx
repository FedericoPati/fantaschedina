import Link from "next/link";

type Props = {
  searchParams: Promise<{
    error?: string;
    message?: string;
  }>;
};

export default async function ForgotPasswordPage({
  searchParams,
}: Props) {
  const params = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f6f6f4] px-4 py-10">
      <div className="w-full max-w-md">
        <div className="rounded-3xl border border-black/5 bg-white p-6 shadow-sm sm:p-8">
          <h1 className="text-2xl font-bold tracking-tight text-gray-950">
            Recupera password
          </h1>

          <p className="mt-2 text-sm text-gray-500">
            Inserisci l&apos;email usata per la registrazione.
          </p>

          {params.error && (
            <div className="mt-5 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
              {params.error}
            </div>
          )}

          {params.message && (
            <div className="mt-5 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {params.message}
            </div>
          )}

          <form
            action="/auth/forgot-password"
            method="post"
            className="mt-6"
          >
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Email
            </label>

            <input
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="nome@email.it"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-950 outline-none transition focus:border-gray-400 focus:bg-white"
            />

            <button
              type="submit"
              className="mt-5 w-full rounded-xl bg-gray-950 px-5 py-3.5 text-sm font-semibold text-white"
            >
              Invia link
            </button>
          </form>

          <Link
            href="/login"
            className="mt-5 block text-center text-sm font-medium text-gray-500 hover:text-gray-950"
          >
            Torna al login
          </Link>
        </div>
      </div>
    </main>
  );
}
