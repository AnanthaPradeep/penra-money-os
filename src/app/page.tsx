import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-8 px-6 py-16">
      <header className="flex flex-col gap-3">
        <span className="w-fit rounded-full border border-current px-3 py-1 text-xs font-medium tracking-wide uppercase opacity-70">
          Phase 2 &middot; Authentication and personal profile
        </span>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          PENRA Money OS
        </h1>
        <p className="text-lg opacity-80">
          Your private personal money operating system.
        </p>
      </header>

      <nav aria-label="Account" className="flex flex-wrap gap-3">
        <Link
          href="/login"
          className="rounded-md border border-current px-4 py-2 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
        >
          Log in
        </Link>
        <Link
          href="/signup"
          className="rounded-md border border-current/40 px-4 py-2 text-sm font-medium opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
        >
          Sign up
        </Link>
      </nav>

      <section
        aria-labelledby="foundation-status-heading"
        className="flex flex-col gap-3"
      >
        <h2
          id="foundation-status-heading"
          className="text-sm font-semibold tracking-wide uppercase opacity-70"
        >
          Foundation status
        </h2>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 rounded-lg border border-current/15 p-4 text-sm sm:grid-cols-2">
          <div className="flex justify-between gap-4 sm:flex-col sm:justify-start">
            <dt className="opacity-70">Application shell</dt>
            <dd className="font-medium">Next.js App Router + TypeScript</dd>
          </div>
          <div className="flex justify-between gap-4 sm:flex-col sm:justify-start">
            <dt className="opacity-70">Backend</dt>
            <dd className="font-medium">Supabase Auth + personal profile</dd>
          </div>
          <div className="flex justify-between gap-4 sm:flex-col sm:justify-start">
            <dt className="opacity-70">Authentication</dt>
            <dd className="font-medium">Email/password, with verification</dd>
          </div>
          <div className="flex justify-between gap-4 sm:flex-col sm:justify-start">
            <dt className="opacity-70">Financial data</dt>
            <dd className="font-medium">None — no finance tables exist yet</dd>
          </div>
        </dl>
      </section>

      <p className="rounded-lg border border-current/15 p-4 text-sm opacity-80">
        Finance features are not yet enabled. Sign up to create your private,
        authenticated account and personal profile &mdash; no accounts,
        transactions, balances, or other financial data are stored, calculated,
        or displayed here yet.
      </p>
    </main>
  );
}
