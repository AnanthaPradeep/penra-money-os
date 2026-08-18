import "server-only";

import { createServerClient } from "@supabase/ssr";
import type { JwtPayload } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import { getClientEnv } from "@/lib/env/client";
import type { Database } from "@/types/database.types";

export type SupabaseSessionRefreshResult = {
  response: NextResponse;
  claims: JwtPayload | null;
};

/**
 * Refreshes the Supabase session for a single Proxy invocation and returns
 * both the outgoing response (carrying any refreshed session cookies) and
 * the verified JWT claims for the current request, if any.
 *
 * Follows the official Supabase SSR pattern exactly:
 *   1. Create a request-scoped server client with a cookie adapter that
 *      writes through to both the request (so downstream Server Components
 *      in this same request see the refreshed cookies) and the response
 *      (so the browser receives them).
 *   2. Immediately call `getClaims()` — no other code runs in between.
 *      `getClaims()` cryptographically verifies the JWT on every call; it
 *      is never safe to substitute `getSession()` here, since that method
 *      trusts the cookie contents without verifying the signature.
 */
export async function refreshSupabaseSession(
  request: NextRequest,
): Promise<SupabaseSessionRefreshResult> {
  let response = NextResponse.next({ request });

  const env = getClientEnv();
  const supabase = createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // Do not insert any code between client creation (above) and the claims
  // check (below) — see the function doc comment.
  const { data } = await supabase.auth.getClaims();

  return { response, claims: data?.claims ?? null };
}
