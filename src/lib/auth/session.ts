import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AuthenticatedUser = {
  id: string;
  email: string | null;
};

/**
 * Returns the current user, derived only from a cryptographically verified
 * JWT — never from a browser-supplied user ID, and never by trusting
 * `getSession()` alone (which reads the session from cookie storage without
 * verifying the token signature). Uses `getClaims()`, which validates the
 * JWT signature against the project's published public keys on every call.
 *
 * Returns `null` for any failure (missing session, invalid/expired token,
 * misconfiguration) — callers decide what "not authenticated" means for
 * their route (redirect, 401, generic error state, etc.).
 */
export async function getAuthenticatedUser(): Promise<AuthenticatedUser | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims?.sub) {
    return null;
  }

  return {
    id: data.claims.sub,
    email: typeof data.claims.email === "string" ? data.claims.email : null,
  };
}
