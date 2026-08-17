import { NextResponse, type NextRequest } from "next/server";

import { logAuthError } from "@/lib/auth/errors";
import { getSafeRedirectPath } from "@/lib/auth/redirect";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * PKCE callback: exchanges a `code` for a session. This is the flow that
 * works out of the box with an UNMODIFIED default Supabase email template
 * (see src/lib/auth/actions.ts — `emailRedirectTo`/`redirectTo` both point
 * here), since `@supabase/ssr` defaults to the PKCE flow type.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const next = getSafeRedirectPath(searchParams.get("next"));

  if (!code) {
    return NextResponse.redirect(
      new URL("/login?error=verification_failed", request.url),
    );
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    // Never include the raw error, the code, or any token value in the
    // redirect URL — only a generic, safe error state.
    logAuthError("auth-callback", error);
    return NextResponse.redirect(
      new URL("/login?error=verification_failed", request.url),
    );
  }

  return NextResponse.redirect(new URL(next, request.url));
}
