/**
 * Strict validation for a user-typed source URL (a research note's source,
 * or a manually added company filing link). These are stored and rendered
 * as a plain hyperlink only — the app never fetches them server-side, so
 * this validation exists purely to keep obviously malicious or malformed
 * values out of storage/rendering, not to authorize a fetch.
 */

const MAX_URL_LENGTH = 2048;

function isPrivateOrLocalHostname(hostname: string): boolean {
  // The WHATWG URL parser keeps an IPv6 host bracketed (e.g. "[::1]") in
  // `.hostname` — strip the brackets before comparing against the
  // unbracketed literal forms below.
  const lower = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (lower === "localhost" || lower.endsWith(".localhost")) {
    return true;
  }

  const ipv4Match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(lower);
  if (ipv4Match) {
    const a = Number(ipv4Match[1]);
    const b = Number(ipv4Match[2]);
    if (a === 0 || a === 10 || a === 127) {
      return true;
    }
    if (a === 169 && b === 254) {
      return true;
    }
    if (a === 172 && b >= 16 && b <= 31) {
      return true;
    }
    if (a === 192 && b === 168) {
      return true;
    }
    return false;
  }

  if (
    lower === "::1" ||
    lower === "::" ||
    lower.startsWith("fc") ||
    lower.startsWith("fd") ||
    lower.startsWith("fe80")
  ) {
    return true;
  }

  return false;
}

export type UrlValidationResult =
  | { success: true; url: string; hostname: string }
  | { success: false; error: string };

/** HTTPS-only, no embedded credentials, no local/private-network destination, bounded length. Rejects javascript:/data:/file: schemes implicitly (they simply aren't "https:"). */
export function validateSourceUrl(raw: string): UrlValidationResult {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return { success: false, error: "Enter a URL." };
  }
  if (trimmed.length > MAX_URL_LENGTH) {
    return { success: false, error: "That URL is too long." };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { success: false, error: "Enter a valid URL." };
  }

  if (parsed.protocol !== "https:") {
    return { success: false, error: "Only https:// links are allowed." };
  }
  if (parsed.username.length > 0 || parsed.password.length > 0) {
    return {
      success: false,
      error: "The URL must not contain a username or password.",
    };
  }
  if (isPrivateOrLocalHostname(parsed.hostname)) {
    return {
      success: false,
      error:
        "This URL points to a local or private address, which isn't allowed.",
    };
  }

  return { success: true, url: parsed.toString(), hostname: parsed.hostname };
}
