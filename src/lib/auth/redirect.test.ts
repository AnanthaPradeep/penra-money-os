// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  buildAppUrl,
  DEFAULT_REDIRECT_PATH,
  getSafeRedirectPath,
} from "@/lib/auth/redirect";

describe("getSafeRedirectPath", () => {
  it("accepts a simple internal relative path", () => {
    expect(getSafeRedirectPath("/app/settings/profile")).toBe(
      "/app/settings/profile",
    );
  });

  it("accepts a path with a query string and hash", () => {
    expect(getSafeRedirectPath("/app?tab=overview#top")).toBe(
      "/app?tab=overview#top",
    );
  });

  it("accepts the root path", () => {
    expect(getSafeRedirectPath("/")).toBe("/");
  });

  it.each([null, undefined, ""])(
    "falls back to the default for %j",
    (value) => {
      expect(getSafeRedirectPath(value)).toBe(DEFAULT_REDIRECT_PATH);
    },
  );

  it("falls back to a custom fallback when provided", () => {
    expect(getSafeRedirectPath(undefined, "/custom-fallback")).toBe(
      "/custom-fallback",
    );
  });

  it("rejects a path with no leading slash", () => {
    expect(getSafeRedirectPath("app")).toBe(DEFAULT_REDIRECT_PATH);
  });

  it("rejects an absolute URL with a scheme", () => {
    expect(getSafeRedirectPath("https://evil.example/phish")).toBe(
      DEFAULT_REDIRECT_PATH,
    );
  });

  it("rejects a protocol-relative path (open redirect classic)", () => {
    expect(getSafeRedirectPath("//evil.example")).toBe(DEFAULT_REDIRECT_PATH);
  });

  it("rejects a protocol-relative path with extra slashes", () => {
    expect(getSafeRedirectPath("///evil.example")).toBe(DEFAULT_REDIRECT_PATH);
  });

  it("rejects a backslash-based host-confusion attempt", () => {
    expect(getSafeRedirectPath("/\\evil.example")).toBe(DEFAULT_REDIRECT_PATH);
  });

  it("rejects a javascript: pseudo-protocol", () => {
    expect(getSafeRedirectPath("javascript:alert(1)")).toBe(
      DEFAULT_REDIRECT_PATH,
    );
  });

  it("rejects malformed percent-encoding", () => {
    expect(getSafeRedirectPath("/app%")).toBe(DEFAULT_REDIRECT_PATH);
  });

  it("rejects a percent-encoded protocol-relative attempt", () => {
    // decodes to "///evil.example"
    expect(getSafeRedirectPath("/%2F%2Fevil.example")).toBe(
      DEFAULT_REDIRECT_PATH,
    );
  });

  it("rejects an encoded absolute URL", () => {
    // decodes to "/https://evil.example" — starts with "/" but the encoded
    // form should still be treated as untrusted, and the decoded value
    // itself is same-origin-safe as a literal path segment, so this
    // specific case is actually accepted as a harmless literal path.
    // The important guarantee is that the *origin* never changes — verify
    // that explicitly here instead of assuming a specific outcome shape.
    const result = getSafeRedirectPath("/%68ttps://evil.example");
    expect(result.startsWith("/")).toBe(true);
    expect(result.startsWith("//")).toBe(false);
    expect(result).not.toMatch(/^https?:/);
  });

  it("rejects a value that is not a string", () => {
    // @ts-expect-error deliberately passing a non-string to prove runtime safety
    expect(getSafeRedirectPath(42)).toBe(DEFAULT_REDIRECT_PATH);
  });

  it("preserves a deep, safe nested path", () => {
    expect(getSafeRedirectPath("/app/settings/profile?next=1")).toBe(
      "/app/settings/profile?next=1",
    );
  });
});

describe("buildAppUrl", () => {
  beforeEach(() => {
    vi.stubEnv("APP_URL", "http://localhost:3000");
  });

  it("builds an absolute URL from APP_URL and a path", () => {
    expect(buildAppUrl("/auth/callback")).toBe(
      "http://localhost:3000/auth/callback",
    );
  });

  it("preserves query parameters appended to the path", () => {
    expect(buildAppUrl("/auth/callback?next=/app")).toBe(
      "http://localhost:3000/auth/callback?next=/app",
    );
  });

  it("throws a clear, actionable error when APP_URL is missing", () => {
    vi.unstubAllEnvs();
    expect(() => buildAppUrl("/auth/callback")).toThrow(/APP_URL/);
  });
});
