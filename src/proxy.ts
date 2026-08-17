import { NextResponse, type NextRequest } from "next/server";

import { getSafeRedirectPath } from "@/lib/auth/redirect";
import { refreshSupabaseSession } from "@/lib/supabase/proxy";

const PROTECTED_PREFIX = "/app";

/**
 * Authenticated users opening these paths are sent to `/app` instead.
 * Deliberately does NOT include `/reset-password` — a password-recovery
 * link establishes a real authenticated session, and redirecting that
 * session away from `/reset-password` would make it impossible to ever
 * complete a password reset (an infinite loop back to `/app`).
 */
const AUTH_ENTRY_PATHS = new Set(["/login", "/signup"]);

function isProtectedPath(pathname: string): boolean {
  return (
    pathname === PROTECTED_PREFIX || pathname.startsWith(`${PROTECTED_PREFIX}/`)
  );
}

export async function proxy(request: NextRequest) {
  const { response, claims } = await refreshSupabaseSession(request);
  const { pathname, search } = request.nextUrl;
  const isAuthenticated = claims !== null;

  if (isProtectedPath(pathname)) {
    if (!isAuthenticated) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set(
        "next",
        getSafeRedirectPath(`${pathname}${search}`),
      );
      return NextResponse.redirect(loginUrl);
    }
    return response;
  }

  if (AUTH_ENTRY_PATHS.has(pathname) && isAuthenticated) {
    return NextResponse.redirect(new URL(PROTECTED_PREFIX, request.url));
  }

  return response;
}

export const config = {
  matcher: [
    // Run on everything except: Next.js static build output, the image
    // optimisation endpoint, the favicon, and common static file
    // extensions (images, fonts, stylesheets, scripts, source maps).
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|woff|woff2|ttf)$).*)",
  ],
};
