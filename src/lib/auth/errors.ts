import { isAuthApiError } from "@supabase/supabase-js";

/**
 * Safe, user-facing auth error categories. Every code path in the app maps
 * whatever Supabase actually returned onto one of these — never a raw
 * Supabase error string, SQL detail, stack trace, or token value.
 */
export type AuthErrorKind =
  | "invalid_credentials"
  | "email_not_verified"
  | "link_invalid_or_expired"
  | "rate_limited"
  | "weak_password"
  | "passwords_identical"
  | "config_unavailable"
  | "validation_failed"
  | "temporary_failure";

const SAFE_MESSAGES: Record<AuthErrorKind, string> = {
  invalid_credentials: "The email or password you entered is incorrect.",
  email_not_verified: "Please verify your email address before signing in.",
  link_invalid_or_expired:
    "This link is invalid or has expired. Please request a new one.",
  rate_limited: "Too many attempts. Please wait a moment and try again.",
  weak_password: "Please choose a longer, more unique password.",
  passwords_identical:
    "Your new password must be different from your current password.",
  config_unavailable:
    "This feature is temporarily unavailable. Please try again later.",
  validation_failed: "Please check the information you entered and try again.",
  temporary_failure: "Something went wrong. Please try again.",
};

/**
 * Maps known Supabase Auth error codes (see `@supabase/auth-js`'s
 * `ErrorCode` union) to a safe category. Anything not listed here — a code
 * the SDK doesn't know about yet, or no code at all — falls back to
 * `temporary_failure`, never a raw error string.
 */
const CODE_TO_KIND: Partial<Record<string, AuthErrorKind>> = {
  invalid_credentials: "invalid_credentials",

  email_not_confirmed: "email_not_verified",

  otp_expired: "link_invalid_or_expired",
  flow_state_not_found: "link_invalid_or_expired",
  flow_state_expired: "link_invalid_or_expired",
  bad_code_verifier: "link_invalid_or_expired",
  bad_jwt: "link_invalid_or_expired",

  session_not_found: "temporary_failure",
  session_expired: "temporary_failure",
  refresh_token_not_found: "temporary_failure",
  refresh_token_already_used: "temporary_failure",
  request_timeout: "temporary_failure",
  unexpected_failure: "temporary_failure",

  over_request_rate_limit: "rate_limited",
  over_email_send_rate_limit: "rate_limited",
  over_sms_send_rate_limit: "rate_limited",

  weak_password: "weak_password",

  same_password: "passwords_identical",

  signup_disabled: "config_unavailable",
  email_provider_disabled: "config_unavailable",
  phone_provider_disabled: "config_unavailable",

  validation_failed: "validation_failed",
  email_address_invalid: "validation_failed",
  bad_json: "validation_failed",
};

/**
 * Normalises any error thrown or returned by a Supabase Auth call into a
 * safe `{ kind, message }` pair suitable for direct display to the user.
 *
 * Deliberately does not accept or return the original error's `message`,
 * `code`, or any other field from Supabase — only the mapped safe message.
 * Callers that need diagnostic detail should call {@link logAuthError}
 * (development-only) alongside this, not instead of it.
 */
export function normalizeAuthError(error: unknown): {
  kind: AuthErrorKind;
  message: string;
} {
  const kind = classifyAuthError(error);
  return { kind, message: SAFE_MESSAGES[kind] };
}

function classifyAuthError(error: unknown): AuthErrorKind {
  if (isAuthApiError(error) && error.code) {
    const mapped = CODE_TO_KIND[error.code];
    if (mapped) {
      return mapped;
    }
  }
  return "temporary_failure";
}

/**
 * Development-only diagnostic logging for an auth failure. Never runs in
 * production, and only ever logs the error's `name`/`code`/`status` — never
 * the raw `message` (which, while normally generic, is still an
 * unnecessary field to forward), never a password, never a token, and
 * never a token hash. Callers must never pass form input into this
 * function; it only ever receives the caught error object.
 */
export function logAuthError(context: string, error: unknown): void {
  if (process.env.NODE_ENV === "production") {
    return;
  }

  const safeDetail = isAuthApiError(error)
    ? { name: error.name, code: error.code, status: error.status }
    : { name: "UnknownError" };

  console.error(`[auth:${context}]`, safeDetail);
}
