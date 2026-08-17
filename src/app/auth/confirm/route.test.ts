// @vitest-environment node
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const verifyOtpMock = vi.fn();
const mockSupabaseClient = { auth: { verifyOtp: verifyOtpMock } };

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => mockSupabaseClient),
}));

function makeRequest(path: string): NextRequest {
  return new NextRequest(new URL(path, "http://localhost:3000"));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /auth/confirm", () => {
  it("verifies a valid signup token hash and redirects to /app", async () => {
    verifyOtpMock.mockResolvedValue({ data: { session: {} }, error: null });
    const { GET } = await import("@/app/auth/confirm/route");

    const response = await GET(
      makeRequest("/auth/confirm?token_hash=valid-hash&type=signup"),
    );

    expect(verifyOtpMock).toHaveBeenCalledWith({
      token_hash: "valid-hash",
      type: "signup",
    });
    const location = new URL(response.headers.get("location")!);
    expect(location.pathname).toBe("/app");
  });

  it("honours a safe next path for a successful signup confirmation", async () => {
    verifyOtpMock.mockResolvedValue({ data: { session: {} }, error: null });
    const { GET } = await import("@/app/auth/confirm/route");

    const response = await GET(
      makeRequest(
        "/auth/confirm?token_hash=valid-hash&type=signup&next=/app/settings/profile",
      ),
    );

    const location = new URL(response.headers.get("location")!);
    expect(location.pathname).toBe("/app/settings/profile");
  });

  it("redirects a successful recovery verification to /reset-password", async () => {
    verifyOtpMock.mockResolvedValue({ data: { session: {} }, error: null });
    const { GET } = await import("@/app/auth/confirm/route");

    const response = await GET(
      makeRequest("/auth/confirm?token_hash=valid-hash&type=recovery"),
    );

    const location = new URL(response.headers.get("location")!);
    expect(location.pathname).toBe("/reset-password");
  });

  it("redirects a FAILED recovery verification to /reset-password too, not a loop back to login", async () => {
    verifyOtpMock.mockResolvedValue({
      data: null,
      error: { message: "raw detail", code: "otp_expired" },
    });
    const { GET } = await import("@/app/auth/confirm/route");

    const response = await GET(
      makeRequest("/auth/confirm?token_hash=expired-hash&type=recovery"),
    );

    // The page itself decides what to show based on session state — this
    // route never redirects a recovery attempt to /login, which would risk
    // a confusing redirect loop between /login and /reset-password.
    const location = new URL(response.headers.get("location")!);
    expect(location.pathname).toBe("/reset-password");
  });

  it("redirects a failed signup verification to a safe generic error state", async () => {
    verifyOtpMock.mockResolvedValue({
      data: null,
      error: { message: "raw internal detail", code: "otp_expired" },
    });
    const { GET } = await import("@/app/auth/confirm/route");

    const response = await GET(
      makeRequest("/auth/confirm?token_hash=expired-hash&type=signup"),
    );

    const location = new URL(response.headers.get("location")!);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("error")).toBe("verification_failed");
    expect(location.toString()).not.toContain("raw internal detail");
  });

  it("rejects a missing token_hash without calling Supabase", async () => {
    const { GET } = await import("@/app/auth/confirm/route");

    const response = await GET(makeRequest("/auth/confirm?type=signup"));

    expect(verifyOtpMock).not.toHaveBeenCalled();
    const location = new URL(response.headers.get("location")!);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("error")).toBe("verification_failed");
  });

  it("rejects an unsupported OTP type without calling Supabase", async () => {
    const { GET } = await import("@/app/auth/confirm/route");

    const response = await GET(
      makeRequest("/auth/confirm?token_hash=some-hash&type=magiclink"),
    );

    expect(verifyOtpMock).not.toHaveBeenCalled();
    const location = new URL(response.headers.get("location")!);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("error")).toBe("verification_failed");
  });

  it("never reflects the token hash back in the redirect URL", async () => {
    verifyOtpMock.mockResolvedValue({
      data: null,
      error: { message: "expired", code: "otp_expired" },
    });
    const { GET } = await import("@/app/auth/confirm/route");

    const response = await GET(
      makeRequest(
        "/auth/confirm?token_hash=super-secret-token-hash-value&type=signup",
      ),
    );

    expect(response.headers.get("location")).not.toContain(
      "super-secret-token-hash-value",
    );
  });

  it("rejects a malicious external next URL, falling back to /app for a successful signup confirmation", async () => {
    verifyOtpMock.mockResolvedValue({ data: { session: {} }, error: null });
    const { GET } = await import("@/app/auth/confirm/route");

    const response = await GET(
      makeRequest(
        `/auth/confirm?token_hash=valid-hash&type=signup&next=${encodeURIComponent("https://evil.example")}`,
      ),
    );

    const location = new URL(response.headers.get("location")!);
    expect(location.host).toBe("localhost:3000");
    expect(location.pathname).toBe("/app");
  });
});
