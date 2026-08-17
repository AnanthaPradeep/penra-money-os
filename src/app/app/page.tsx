import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { LogoutButton } from "@/components/auth/LogoutButton";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { getProfileForUser } from "@/lib/profile/queries";

export const metadata: Metadata = {
  title: "PENRA Money OS",
  description: "Your authenticated PENRA Money OS home.",
};

/**
 * Already gated by src/proxy.ts for unauthenticated requests, but Server
 * Functions are not guaranteed to be covered by every Proxy matcher change,
 * so this page independently re-verifies the session rather than assuming
 * Proxy already handled it — defence in depth, per Next.js's own guidance.
 */
export default async function AppHomePage() {
  const user = await getAuthenticatedUser();
  if (!user) {
    redirect("/login?next=/app");
  }

  const profile = await getProfileForUser(user.id);
  const displayName = profile?.display_name;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-8 px-6 py-16">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">
          PENRA Money OS
        </h1>
        <p className="text-lg opacity-80">
          {displayName ? `Welcome back, ${displayName}.` : "Welcome back."}
        </p>
      </header>

      <section
        aria-labelledby="account-heading"
        className="flex flex-col gap-3"
      >
        <h2
          id="account-heading"
          className="text-sm font-semibold tracking-wide uppercase opacity-70"
        >
          Account
        </h2>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 rounded-lg border border-current/15 p-4 text-sm sm:grid-cols-2">
          <div className="flex justify-between gap-4 sm:flex-col sm:justify-start">
            <dt className="opacity-70">Signed in as</dt>
            <dd className="font-medium">{user.email ?? "—"}</dd>
          </div>
          <div className="flex justify-between gap-4 sm:flex-col sm:justify-start">
            <dt className="opacity-70">Status</dt>
            <dd className="font-medium">Authenticated</dd>
          </div>
        </dl>
      </section>

      <nav
        aria-label="Account actions"
        className="flex flex-wrap items-start gap-3"
      >
        <Link
          href="/app/settings/profile"
          className="rounded-md border border-current px-4 py-2 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
        >
          Profile settings
        </Link>
        <LogoutButton />
      </nav>

      <p className="rounded-lg border border-current/15 p-4 text-sm opacity-80">
        Financial modules &mdash; accounts, transactions, budgets, and
        investments &mdash; begin in later phases. This is your authenticated
        home for now.
      </p>
    </main>
  );
}
