import { NextResponse, type NextRequest } from "next/server";

import { logAuthError } from "@/lib/auth/errors";
import { getSafeRedirectPath } from "@/lib/auth/redirect";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Token-hash callback: verifies `token_hash` + `type` directly, without a
 * round trip through a Supabase-hosted verify page. This is the CURRENT
 * Supabase-recommended email-confirmation approach, but it only fires if
 * the project's email templates have been customised to link here (the
 * default templates use the PKCE `code` flow instead — see
 * src/app/auth/callback/route.ts). Implemented regardless, so it works the
 * moment someone updates their templates — see the chat response for the
 * exact template values to set in the Supabase dashboard.
 */
const SUPPORTED_OTP_TYPES = ["signup", "recovery", "email"] as const;
type SupportedOtpType = (typeof SUPPORTED_OTP_TYPES)[number];

function isSupportedOtpType(value: string | null): value is SupportedOtpType {
  return (SUPPORTED_OTP_TYPES as readonly string[]).includes(value ?? "");
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const nextParam = searchParams.get("next");

  if (!tokenHash || !isSupportedOtpType(type)) {
    return NextResponse.redirect(
      new URL("/login?error=verification_failed", request.url),
    );
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type,
  });

  if (error) {
    // Never log the token hash itself, and never reflect it back in any
    // redirect URL or rendered UI.
    logAuthError("auth-confirm", error);
  }

  if (type === "recovery") {
    // Whether verification succeeded or failed, `/reset-password`'s own
    // session check is the source of truth for what the user sees: a
    // valid recovery session shows the reset form, no session shows the
    // safe expired-or-invalid-link state. This also means a recovery
    // failure never redirects back into a `/login` <-> `/reset-password`
    // loop.
    return NextResponse.redirect(new URL("/reset-password", request.url));
  }

  if (error) {
    return NextResponse.redirect(
      new URL("/login?error=verification_failed", request.url),
    );
  }

  const next = getSafeRedirectPath(nextParam, "/app");
  return NextResponse.redirect(new URL(next, request.url));
}
