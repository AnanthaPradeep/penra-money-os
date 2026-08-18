import { createBrowserClient } from "@supabase/ssr";

import { getClientEnv } from "@/lib/env/client";
import type { Database } from "@/types/database.types";

/**
 * Creates a Supabase client for use in the browser (Client Components).
 *
 * Uses only the public URL and publishable key — never a secret key.
 * `createBrowserClient` already implements a singleton internally (per the
 * official Supabase SSR guidance), so calling this repeatedly does not
 * create redundant client instances; no extra memoization is added here.
 *
 * Typed against the generated `Database` schema (see
 * src/types/database.types.ts, generated via `pnpm db:types:local` /
 * `pnpm db:types:linked`) so query results are typed, not `any`.
 */
export function createSupabaseBrowserClient() {
  const env = getClientEnv();

  return createBrowserClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}
