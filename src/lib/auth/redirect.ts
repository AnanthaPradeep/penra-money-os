import "server-only";

import { NextResponse, type NextRequest } from "next/server";

import { getServerEnv } from "@/lib/env/server";
import { getAuthenticatedUser } from "@/lib/auth/session";

/** Where an unrecognised or unsafe redirect target falls back to. */
export const DEFAULT_REDIRECT_PATH = "/app";

/**
 * Validates an untrusted `next` redirect candidate (from a query string or
 * form field) and returns a path that is guaranteed safe to redirect to
 * within this application — never an open redirect to another host.
 *
 * Accepts only:
 *   - a single leading `/` (an internal relative path)
 *
 * Rejects:
 *   - absolute URLs (`https://evil.example/...`)
 *   - protocol-relative paths (`//evil.example`)
 *   - backslash tricks some URL parsers treat as `/` for special schemes
 *     (e.g. `/\evil.example`, which a browser can resolve as `//evil.example`)
 *   - malformed percent-encoding
 *   - anything that, once decoded and parsed, would resolve to a different
 *     origin than this app's own placeholder origin
 *
 * Falls back to {@link DEFAULT_REDIRECT_PATH} (or an explicit override) for
 * anything that doesn't pass every check.
 */
export function getSafeRedirectPath(
  candidate: string | null | undefined,
  fallback: string = DEFAULT_REDIRECT_PATH,
): string {
  if (!candidate || typeof candidate !== "string") {
    return fallback;
  }

  // Fast, explicit rejections before attempting any parsing.
  if (!candidate.startsWith("/") || candidate.startsWith("//")) {
    return fallback;
  }
  if (candidate.includes("\\")) {
    return fallback;
  }

  let decoded: string;
  try {
    decoded = decodeURIComponent(candidate);
  } catch {
    // Malformed percent-encoding (e.g. a lone "%").
    return fallback;
  }

  if (!decoded.startsWith("/") || decoded.startsWith("//")) {
    return fallback;
  }
  if (decoded.includes("\\")) {
    return fallback;
  }

  // Authoritative check: resolve against a fixed, throwaway origin and
  // confirm the origin never changed. This catches any parser-quirk-based
  // bypass the string checks above didn't anticipate.
  let parsed: URL;
  try {
    parsed = new URL(decoded, "http://internal.invalid");
  } catch {
    return fallback;
  }
  if (parsed.origin !== "http://internal.invalid") {
    return fallback;
  }

  const safePath = `${parsed.pathname}${parsed.search}${parsed.hash}`;
  return safePath.startsWith("/") && !safePath.startsWith("//")
    ? safePath
    : fallback;
}

/**
 * Builds an absolute URL under this application's trusted `APP_URL` for use
 * in Supabase auth email redirects (`emailRedirectTo` / `redirectTo`).
 *
 * `APP_URL` comes from validated server-only configuration, never from
 * request headers (e.g. `Host`), which an attacker can control.
 */
export function buildAppUrl(path: string): string {
  const { APP_URL } = getServerEnv();
  return new URL(path, APP_URL).toString();
}

/**
 * Redirect target for a signup-confirmation link (`/auth/callback` or
 * `/auth/confirm`) that failed to verify. A failure here is ambiguous by
 * itself — the same "invalid or expired" response also happens for a link
 * that already succeeded once, since confirmation tokens are single-use
 * (a second click, or an email client prescanning the link before the
 * real click, both hit an already-consumed token). Checking for an
 * existing verified session disambiguates the two: if one is present,
 * this browser already completed confirmation earlier and the user goes
 * straight to `next` instead of seeing a scary error for something that
 * already succeeded.
 */
export async function verificationFailureRedirect(
  request: NextRequest,
  next: string,
): Promise<NextResponse> {
  const user = await getAuthenticatedUser();
  if (user) {
    return NextResponse.redirect(new URL(next, request.url));
  }
  return NextResponse.redirect(
    new URL("/login?error=verification_failed", request.url),
  );
}
