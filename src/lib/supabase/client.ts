import { createBrowserClient } from "@supabase/ssr";

import { getClientEnv } from "@/lib/env/client";

/**
 * Creates a Supabase client for use in the browser (Client Components).
 *
 * Uses only the public URL and publishable key — never a secret key.
 * `createBrowserClient` already implements a singleton internally (per the
 * official Supabase SSR guidance), so calling this repeatedly does not
 * create redundant client instances; no extra memoization is added here.
 *
 * This factory contains no application-specific queries — Phase 1 only
 * establishes the client foundation. Query logic starts in a later phase.
 */
export function createSupabaseBrowserClient() {
  const env = getClientEnv();

  return createBrowserClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}
