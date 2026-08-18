import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { AppShell } from "@/components/shell/AppShell";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { getProfileForUser } from "@/lib/profile/queries";

/**
 * Applies to every route under /app — the one place the shell chrome
 * (sidebar, mobile nav, theme switcher, profile menu) is rendered. Also
 * gated by src/proxy.ts, but re-verifies the session here too, same as
 * every individual /app page already did before this shell existed —
 * that per-page check is left in place (defense in depth), this is an
 * independent, redundant confirmation the shell itself needs to know who
 * is signed in, not a replacement for it.
 */
export default async function AppLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const user = await getAuthenticatedUser();
  if (!user) {
    redirect("/login?next=/app");
  }

  const profile = await getProfileForUser(user.id);

  return (
    <AppShell displayName={profile?.display_name ?? null} email={user.email}>
      {children}
    </AppShell>
  );
}
