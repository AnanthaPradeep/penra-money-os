// @vitest-environment node
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const exchangeCodeForSessionMock = vi.fn();
const mockSupabaseClient = {
  auth: { exchangeCodeForSession: exchangeCodeForSessionMock },
};

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(() => Promise.resolve(mockSupabaseClient)),
}));

function makeRequest(path: string): NextRequest {
  return new NextRequest(new URL(path, "http://localhost:3000"));
}

function redirectLocation(response: Response): URL {
  const location = response.headers.get("location");
  if (location === null) {
    throw new Error("response has no Location header");
  }
  return new URL(location);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /auth/callback", () => {
  it("exchanges a valid PKCE code and redirects to the safe next path", async () => {
    exchangeCodeForSessionMock.mockResolvedValue({
      data: { session: {}, user: { id: "user-1" } },
      error: null,
    });
    const { GET } = await import("@/app/auth/callback/route");

    const response = await GET(
      makeRequest("/auth/callback?code=valid-code&next=/app/settings/profile"),
    );

    expect(exchangeCodeForSessionMock).toHaveBeenCalledWith("valid-code");
    expect(response.status).toBe(307);
    const location = redirectLocation(response);
    expect(location.pathname).toBe("/app/settings/profile");
  });

  it("defaults to /app when no next path is present", async () => {
    exchangeCodeForSessionMock.mockResolvedValue({
      data: { session: {}, user: { id: "user-1" } },
      error: null,
    });
    const { GET } = await import("@/app/auth/callback/route");

    const response = await GET(makeRequest("/auth/callback?code=valid-code"));

    const location = redirectLocation(response);
    expect(location.pathname).toBe("/app");
  });

  it("redirects to a safe generic error state when no code is present", async () => {
    const { GET } = await import("@/app/auth/callback/route");

    const response = await GET(makeRequest("/auth/callback"));

    expect(exchangeCodeForSessionMock).not.toHaveBeenCalled();
    const location = redirectLocation(response);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("error")).toBe("verification_failed");
  });

  it("redirects to a safe generic error state when the code exchange fails", async () => {
    exchangeCodeForSessionMock.mockResolvedValue({
      data: { session: null, user: null },
      error: { message: "raw internal detail", code: "bad_code_verifier" },
    });
    const { GET } = await import("@/app/auth/callback/route");

    const response = await GET(makeRequest("/auth/callback?code=bad-code"));

    const location = redirectLocation(response);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("error")).toBe("verification_failed");
    // No raw error detail, code value, or token anywhere in the redirect URL.
    expect(location.toString()).not.toContain("raw internal detail");
    expect(location.toString()).not.toContain("bad-code");
  });

  it("rejects a malicious external next URL, falling back to /app", async () => {
    exchangeCodeForSessionMock.mockResolvedValue({
      data: { session: {}, user: { id: "user-1" } },
      error: null,
    });
    const { GET } = await import("@/app/auth/callback/route");

    const response = await GET(
      makeRequest(
        `/auth/callback?code=valid-code&next=${encodeURIComponent("https://evil.example")}`,
      ),
    );

    const location = redirectLocation(response);
    expect(location.host).toBe("localhost:3000");
    expect(location.pathname).toBe("/app");
  });

  it("rejects a protocol-relative next URL", async () => {
    exchangeCodeForSessionMock.mockResolvedValue({
      data: { session: {}, user: { id: "user-1" } },
      error: null,
    });
    const { GET } = await import("@/app/auth/callback/route");

    const response = await GET(
      makeRequest(
        `/auth/callback?code=valid-code&next=${encodeURIComponent("//evil.example")}`,
      ),
    );

    const location = redirectLocation(response);
    expect(location.host).toBe("localhost:3000");
    expect(location.pathname).toBe("/app");
  });
});
