import { AuthApiError } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";

import { logAuthError, normalizeAuthError } from "@/lib/auth/errors";

function authApiError(code: string, message = "Some Supabase message") {
  return new AuthApiError(message, 400, code);
}

describe("normalizeAuthError", () => {
  it("maps invalid_credentials to a generic invalid-credentials message", () => {
    const result = normalizeAuthError(authApiError("invalid_credentials"));
    expect(result.kind).toBe("invalid_credentials");
    expect(result.message).not.toMatch(/supabase/i);
  });

  it("maps email_not_confirmed to email_not_verified", () => {
    const result = normalizeAuthError(authApiError("email_not_confirmed"));
    expect(result.kind).toBe("email_not_verified");
  });

  it("maps otp_expired to link_invalid_or_expired", () => {
    const result = normalizeAuthError(authApiError("otp_expired"));
    expect(result.kind).toBe("link_invalid_or_expired");
  });

  it("maps over_email_send_rate_limit to rate_limited", () => {
    const result = normalizeAuthError(
      authApiError("over_email_send_rate_limit"),
    );
    expect(result.kind).toBe("rate_limited");
  });

  it("maps weak_password to weak_password", () => {
    const result = normalizeAuthError(authApiError("weak_password"));
    expect(result.kind).toBe("weak_password");
  });

  it("maps same_password to passwords_identical", () => {
    const result = normalizeAuthError(authApiError("same_password"));
    expect(result.kind).toBe("passwords_identical");
  });

  it("maps signup_disabled to config_unavailable", () => {
    const result = normalizeAuthError(authApiError("signup_disabled"));
    expect(result.kind).toBe("config_unavailable");
  });

  it("falls back to temporary_failure for an unrecognised error code", () => {
    const result = normalizeAuthError(
      authApiError("some_future_code_the_sdk_does_not_know_about"),
    );
    expect(result.kind).toBe("temporary_failure");
  });

  it("falls back to temporary_failure for a non-auth error", () => {
    const result = normalizeAuthError(
      new Error("plain error, not from Supabase"),
    );
    expect(result.kind).toBe("temporary_failure");
  });

  it("falls back to temporary_failure for a non-error thrown value", () => {
    const result = normalizeAuthError("a raw string was thrown");
    expect(result.kind).toBe("temporary_failure");
  });

  it("never includes the original Supabase message text in the output", () => {
    const distinctiveMarker = "xyzzy-distinctive-raw-supabase-text-42";
    const result = normalizeAuthError(
      authApiError("invalid_credentials", distinctiveMarker),
    );
    expect(result.message).not.toContain(distinctiveMarker);
  });

  it("never includes a SQL-looking detail even if present on the error", () => {
    const result = normalizeAuthError(
      authApiError(
        "unexpected_failure",
        'duplicate key value violates unique constraint "profiles_pkey"',
      ),
    );
    expect(result.message).not.toMatch(/constraint|pkey|sql/i);
  });
});

describe("logAuthError", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("does not log anything in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    logAuthError("login", authApiError("invalid_credentials", "secret detail"));

    expect(spy).not.toHaveBeenCalled();
  });

  it("logs only safe fields outside production", () => {
    vi.stubEnv("NODE_ENV", "development");
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    logAuthError(
      "login",
      authApiError("invalid_credentials", "a message with a password: hunter2"),
    );

    expect(spy).toHaveBeenCalledTimes(1);
    const call: unknown[] | undefined = spy.mock.calls[0];
    if (!call) {
      throw new Error("spy was not called");
    }
    const loggedArgs: unknown[] = call;
    const loggedPayload = JSON.stringify(loggedArgs);
    expect(loggedPayload).not.toContain("hunter2");
    expect(loggedPayload).toContain("invalid_credentials");
  });
});
