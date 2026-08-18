// @vitest-environment node
import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const refreshSupabaseSessionMock = vi.fn();
vi.mock("@/lib/supabase/proxy", () => ({
  refreshSupabaseSession: refreshSupabaseSessionMock,
}));

function makeRequest(
  path: string,
  headers?: Record<string, string>,
): NextRequest {
  return new NextRequest(new URL(path, "http://localhost:3000"), {
    ...(headers ? { headers } : {}),
  });
}

function redirectLocation(response: Response): URL {
  const location = response.headers.get("location");
  if (location === null) {
    throw new Error("response has no Location header");
  }
  return new URL(location);
}

function mockSession(claims: Record<string, unknown> | null) {
  refreshSupabaseSessionMock.mockResolvedValue({
    response: NextResponse.next(),
    claims,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("proxy", () => {
  it("allows an unauthenticated request to a public route through unmodified", async () => {
    mockSession(null);
    const { proxy } = await import("@/proxy");

    const response = await proxy(makeRequest("/"));

    expect(response.headers.get("location")).toBeNull();
  });

  it("redirects an unauthenticated request to a protected route to /login", async () => {
    mockSession(null);
    const { proxy } = await import("@/proxy");

    const response = await proxy(makeRequest("/app/settings/profile"));

    expect(response.status).toBe(307);
    const location = redirectLocation(response);
    expect(location.pathname).toBe("/login");
  });

  it("preserves a safe next path when redirecting to /login", async () => {
    mockSession(null);
    const { proxy } = await import("@/proxy");

    const response = await proxy(makeRequest("/app/settings/profile"));

    const location = redirectLocation(response);
    expect(location.searchParams.get("next")).toBe("/app/settings/profile");
  });

  it("allows an authenticated user to access /app", async () => {
    mockSession({ sub: "user-1" });
    const { proxy } = await import("@/proxy");

    const response = await proxy(makeRequest("/app"));

    expect(response.headers.get("location")).toBeNull();
  });

  it("allows an authenticated user to access a nested /app/* route", async () => {
    mockSession({ sub: "user-1" });
    const { proxy } = await import("@/proxy");

    const response = await proxy(makeRequest("/app/settings/profile"));

    expect(response.headers.get("location")).toBeNull();
  });

  it("redirects an authenticated user away from /login to /app", async () => {
    mockSession({ sub: "user-1" });
    const { proxy } = await import("@/proxy");

    const response = await proxy(makeRequest("/login"));

    expect(response.status).toBe(307);
    const location = redirectLocation(response);
    expect(location.pathname).toBe("/app");
  });

  it("redirects an authenticated user away from /signup to /app", async () => {
    mockSession({ sub: "user-1" });
    const { proxy } = await import("@/proxy");

    const response = await proxy(makeRequest("/signup"));

    const location = redirectLocation(response);
    expect(location.pathname).toBe("/app");
  });

  it("does NOT redirect an authenticated (recovery) user away from /reset-password — no loop", async () => {
    mockSession({ sub: "user-1" });
    const { proxy } = await import("@/proxy");

    const response = await proxy(makeRequest("/reset-password"));

    expect(response.headers.get("location")).toBeNull();
  });

  it("leaves /reset-password reachable for an unauthenticated visitor too", async () => {
    mockSession(null);
    const { proxy } = await import("@/proxy");

    const response = await proxy(makeRequest("/reset-password"));

    expect(response.headers.get("location")).toBeNull();
  });

  it("leaves /auth/callback and /auth/confirm reachable regardless of auth state", async () => {
    mockSession(null);
    const { proxy } = await import("@/proxy");

    const callbackResponse = await proxy(
      makeRequest("/auth/callback?code=abc"),
    );
    const confirmResponse = await proxy(
      makeRequest("/auth/confirm?token_hash=abc&type=signup"),
    );

    expect(callbackResponse.headers.get("location")).toBeNull();
    expect(confirmResponse.headers.get("location")).toBeNull();
  });

  it("builds the redirect using the request's own trusted origin, never a spoofed forwarded-host header", async () => {
    mockSession(null);
    const { proxy } = await import("@/proxy");

    const response = await proxy(
      makeRequest("/app", { "x-forwarded-host": "evil.example" }),
    );

    const location = redirectLocation(response);
    expect(location.host).toBe("localhost:3000");
  });
});

describe("proxy matcher", () => {
  it("excludes Next.js static assets, the image endpoint, the favicon, and common static extensions", async () => {
    const { config } = await import("@/proxy");
    const pattern = config.matcher[0];
    const regex = new RegExp(`^${pattern}$`);

    // Included (proxy should run):
    expect(regex.test("/")).toBe(true);
    expect(regex.test("/app")).toBe(true);
    expect(regex.test("/login")).toBe(true);
    expect(regex.test("/auth/callback")).toBe(true);

    // Excluded (proxy should NOT run):
    expect(regex.test("/_next/static/chunk.js")).toBe(false);
    expect(regex.test("/_next/image")).toBe(false);
    expect(regex.test("/favicon.ico")).toBe(false);
    expect(regex.test("/logo.svg")).toBe(false);
    expect(regex.test("/styles.css")).toBe(false);
    expect(regex.test("/script.js")).toBe(false);
  });
});
