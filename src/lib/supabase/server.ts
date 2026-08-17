import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { getClientEnv } from "@/lib/env/client";

/**
 * Creates a Supabase client for use on the server (Server Components,
 * Server Functions, Route Handlers).
 *
 * The `server-only` import above makes the build fail loudly if this module
 * is ever pulled into a client bundle by mistake.
 *
 * A fresh client is created on every call — per the official Supabase SSR
 * guidance, the server client cannot be reused across requests because it
 * is bound to that request's cookies.
 *
 * Uses only the public URL and publishable key. There is no genuine Phase 1
 * need for a secret/service-role key (no privileged server-side operation
 * exists yet), so none is read or referenced here — see
 * docs/phase-1/03-supabase-foundation.md.
 *
 * This factory contains no application-specific queries, no login/signup/
 * logout functions, and no route protection — those belong to Phase 2.
 */
export async function createSupabaseServerClient() {
  const env = getClientEnv();
  const cookieStore = await cookies();

  return createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // `setAll` was called from a Server Component, which cannot set
            // cookies. This is safe to ignore as long as session refresh is
            // handled in `proxy.ts` (Next.js's Proxy convention) — that is
            // Phase 2 work and is intentionally not implemented yet.
          }
        },
      },
    },
  );
}
