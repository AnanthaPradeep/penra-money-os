// @vitest-environment node
import { AuthApiError } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { INITIAL_AUTH_ACTION_STATE } from "@/lib/auth/action-state";

vi.mock("server-only", () => ({}));

const redirectMock = vi.fn((url: string) => {
  const error = new Error(`NEXT_REDIRECT:${url}`);
  (error as unknown as { digest: string }).digest =
    `NEXT_REDIRECT;push;${url};307;`;
  throw error;
});

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

const mockAuth = {
  signUp: vi.fn(),
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
  resend: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  updateUser: vi.fn(),
  getClaims: vi.fn(),
};

const mockSupabaseClient = { auth: mockAuth };

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => mockSupabaseClient),
}));

function formDataOf(fields: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    formData.set(key, value);
  }
  return formData;
}

function expectRedirectTo(path: string) {
  expect(redirectMock).toHaveBeenCalledWith(path);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("APP_URL", "http://localhost:3000");
  mockAuth.signOut.mockResolvedValue({ error: null });
});

const VALID_SIGNUP_FIELDS = {
  displayName: "Asha Rao",
  email: "asha@example.com",
  password: "correct horse battery staple",
  confirmPassword: "correct horse battery staple",
};

describe("signUpAction", () => {
  it("redirects to /verify-email when signup succeeds and requires verification", async () => {
    const { signUpAction } = await import("@/lib/auth/actions");
    mockAuth.signUp.mockResolvedValue({
      data: { user: { id: "user-1" }, session: null },
      error: null,
    });

    await expect(
      signUpAction(INITIAL_AUTH_ACTION_STATE, formDataOf(VALID_SIGNUP_FIELDS)),
    ).rejects.toThrow(/NEXT_REDIRECT/);

    expectRedirectTo("/verify-email");
    expect(mockAuth.signUp).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "asha@example.com",
        password: VALID_SIGNUP_FIELDS.password,
        options: expect.objectContaining({
          data: { display_name: "Asha Rao" },
        }),
      }),
    );
  });

  it("passes the display name only through safe user metadata, never as a top-level field", async () => {
    const { signUpAction } = await import("@/lib/auth/actions");
    mockAuth.signUp.mockResolvedValue({
      data: { user: { id: "user-1" }, session: null },
      error: null,
    });

    await expect(
      signUpAction(INITIAL_AUTH_ACTION_STATE, formDataOf(VALID_SIGNUP_FIELDS)),
    ).rejects.toThrow();

    const call = mockAuth.signUp.mock.calls[0]![0];
    expect(call.displayName).toBeUndefined();
    expect(call.options.data.display_name).toBe("Asha Rao");
  });

  it("redirects to the safe next path when Supabase immediately returns a session", async () => {
    const { signUpAction } = await import("@/lib/auth/actions");
    mockAuth.signUp.mockResolvedValue({
      data: {
        user: { id: "user-1" },
        session: { access_token: "fake", refresh_token: "fake" },
      },
      error: null,
    });

    await expect(
      signUpAction(
        INITIAL_AUTH_ACTION_STATE,
        formDataOf({ ...VALID_SIGNUP_FIELDS, next: "/app/settings/profile" }),
      ),
    ).rejects.toThrow();

    expectRedirectTo("/app/settings/profile");
  });

  it("returns a field-level validation error and never calls Supabase for invalid input", async () => {
    const { signUpAction } = await import("@/lib/auth/actions");

    const result = await signUpAction(
      INITIAL_AUTH_ACTION_STATE,
      formDataOf({ ...VALID_SIGNUP_FIELDS, email: "not-an-email" }),
    );

    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.fieldErrors?.email).toBeDefined();
    }
    expect(mockAuth.signUp).not.toHaveBeenCalled();
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("treats an already-registered email the same as a normal verification outcome", async () => {
    const { signUpAction } = await import("@/lib/auth/actions");
    mockAuth.signUp.mockResolvedValue({
      data: { user: null, session: null },
      error: new AuthApiError(
        "User already registered",
        400,
        "user_already_exists",
      ),
    });

    await expect(
      signUpAction(INITIAL_AUTH_ACTION_STATE, formDataOf(VALID_SIGNUP_FIELDS)),
    ).rejects.toThrow();

    expectRedirectTo("/verify-email");
  });

  it("returns a safe generic message for a genuine signup failure, never the raw Supabase message", async () => {
    const { signUpAction } = await import("@/lib/auth/actions");
    mockAuth.signUp.mockResolvedValue({
      data: { user: null, session: null },
      error: new AuthApiError(
        "raw internal supabase detail that must never reach the UI",
        400,
        "signup_disabled",
      ),
    });

    const result = await signUpAction(
      INITIAL_AUTH_ACTION_STATE,
      formDataOf(VALID_SIGNUP_FIELDS),
    );

    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.message).not.toContain("raw internal supabase detail");
    }
  });
});

describe("logInAction", () => {
  it("redirects to the safe next path on successful login", async () => {
    const { logInAction } = await import("@/lib/auth/actions");
    mockAuth.signInWithPassword.mockResolvedValue({
      data: { user: { id: "user-1" }, session: {} },
      error: null,
    });

    await expect(
      logInAction(
        INITIAL_AUTH_ACTION_STATE,
        formDataOf({
          email: "asha@example.com",
          password: "whatever-password",
          next: "/app/settings/profile",
        }),
      ),
    ).rejects.toThrow();

    expectRedirectTo("/app/settings/profile");
  });

  it("defaults to /app when no next path was submitted", async () => {
    const { logInAction } = await import("@/lib/auth/actions");
    mockAuth.signInWithPassword.mockResolvedValue({
      data: { user: { id: "user-1" }, session: {} },
      error: null,
    });

    await expect(
      logInAction(
        INITIAL_AUTH_ACTION_STATE,
        formDataOf({
          email: "asha@example.com",
          password: "whatever-password",
        }),
      ),
    ).rejects.toThrow();

    expectRedirectTo("/app");
  });

  it("rejects an unsafe external next path", async () => {
    const { logInAction } = await import("@/lib/auth/actions");
    mockAuth.signInWithPassword.mockResolvedValue({
      data: { user: { id: "user-1" }, session: {} },
      error: null,
    });

    await expect(
      logInAction(
        INITIAL_AUTH_ACTION_STATE,
        formDataOf({
          email: "asha@example.com",
          password: "whatever-password",
          next: "https://evil.example",
        }),
      ),
    ).rejects.toThrow();

    expectRedirectTo("/app");
  });

  it("returns a generic invalid-credentials message and never the raw Supabase error", async () => {
    const { logInAction } = await import("@/lib/auth/actions");
    mockAuth.signInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: new AuthApiError(
        "Invalid login credentials (raw supabase text)",
        400,
        "invalid_credentials",
      ),
    });

    const result = await logInAction(
      INITIAL_AUTH_ACTION_STATE,
      formDataOf({ email: "asha@example.com", password: "wrong-password" }),
    );

    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.message).not.toContain("raw supabase text");
      expect(result.message.toLowerCase()).toContain("incorrect");
    }
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("returns an email-verification-required message for an unverified account", async () => {
    const { logInAction } = await import("@/lib/auth/actions");
    mockAuth.signInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: new AuthApiError(
        "Email not confirmed",
        400,
        "email_not_confirmed",
      ),
    });

    const result = await logInAction(
      INITIAL_AUTH_ACTION_STATE,
      formDataOf({ email: "asha@example.com", password: "whatever-password" }),
    );

    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.message.toLowerCase()).toContain("verify");
    }
  });

  it("returns a field validation error for an empty password without calling Supabase", async () => {
    const { logInAction } = await import("@/lib/auth/actions");

    const result = await logInAction(
      INITIAL_AUTH_ACTION_STATE,
      formDataOf({ email: "asha@example.com", password: "" }),
    );

    expect(result.status).toBe("error");
    expect(mockAuth.signInWithPassword).not.toHaveBeenCalled();
  });
});

describe("logOutAction", () => {
  it("signs out and redirects to /login", async () => {
    const { logOutAction } = await import("@/lib/auth/actions");

    await expect(logOutAction()).rejects.toThrow();

    expect(mockAuth.signOut).toHaveBeenCalledTimes(1);
    expectRedirectTo("/login");
  });
});

describe("forgotPasswordAction", () => {
  it("always returns the same privacy-preserving message on success", async () => {
    const { forgotPasswordAction } = await import("@/lib/auth/actions");
    mockAuth.resetPasswordForEmail.mockResolvedValue({ data: {}, error: null });

    const result = await forgotPasswordAction(
      INITIAL_AUTH_ACTION_STATE,
      formDataOf({ email: "exists@example.com" }),
    );

    expect(result).toEqual({
      status: "success",
      message:
        "If an account exists for that email, password reset instructions will be sent.",
    });
  });

  it("returns the identical message even when Supabase reports the account does not exist", async () => {
    const { forgotPasswordAction } = await import("@/lib/auth/actions");
    mockAuth.resetPasswordForEmail.mockResolvedValue({
      data: null,
      error: new AuthApiError("User not found", 400, "user_not_found"),
    });

    const result = await forgotPasswordAction(
      INITIAL_AUTH_ACTION_STATE,
      formDataOf({ email: "does-not-exist@example.com" }),
    );

    expect(result).toEqual({
      status: "success",
      message:
        "If an account exists for that email, password reset instructions will be sent.",
    });
  });

  it("surfaces a distinct message only for rate limiting, which does not reveal account existence", async () => {
    const { forgotPasswordAction } = await import("@/lib/auth/actions");
    mockAuth.resetPasswordForEmail.mockResolvedValue({
      data: null,
      error: new AuthApiError(
        "rate limited",
        429,
        "over_email_send_rate_limit",
      ),
    });

    const result = await forgotPasswordAction(
      INITIAL_AUTH_ACTION_STATE,
      formDataOf({ email: "someone@example.com" }),
    );

    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.message.toLowerCase()).toContain("wait");
    }
  });

  it("rejects an invalid email without calling Supabase", async () => {
    const { forgotPasswordAction } = await import("@/lib/auth/actions");

    const result = await forgotPasswordAction(
      INITIAL_AUTH_ACTION_STATE,
      formDataOf({ email: "not-an-email" }),
    );

    expect(result.status).toBe("error");
    expect(mockAuth.resetPasswordForEmail).not.toHaveBeenCalled();
  });
});

describe("resendVerificationAction", () => {
  it("always returns the same privacy-preserving message on success", async () => {
    const { resendVerificationAction } = await import("@/lib/auth/actions");
    mockAuth.resend.mockResolvedValue({ data: {}, error: null });

    const result = await resendVerificationAction(
      INITIAL_AUTH_ACTION_STATE,
      formDataOf({ email: "asha@example.com" }),
    );

    expect(result.status).toBe("success");
  });
});

describe("resetPasswordAction", () => {
  const VALID_RESET_FIELDS = {
    password: "a brand new long password",
    confirmPassword: "a brand new long password",
  };

  it("updates the password, signs out, and redirects to login on success", async () => {
    const { resetPasswordAction } = await import("@/lib/auth/actions");
    mockAuth.getClaims.mockResolvedValue({
      data: { claims: { sub: "user-1" } },
      error: null,
    });
    mockAuth.updateUser.mockResolvedValue({ data: {}, error: null });

    await expect(
      resetPasswordAction(
        INITIAL_AUTH_ACTION_STATE,
        formDataOf(VALID_RESET_FIELDS),
      ),
    ).rejects.toThrow();

    expect(mockAuth.updateUser).toHaveBeenCalledWith({
      password: VALID_RESET_FIELDS.password,
    });
    expect(mockAuth.signOut).toHaveBeenCalledTimes(1);
    expectRedirectTo("/login?resetSuccess=1");
  });

  it("shows a safe expired-link state when no recovery/auth session exists", async () => {
    const { resetPasswordAction } = await import("@/lib/auth/actions");
    mockAuth.getClaims.mockResolvedValue({ data: null, error: null });

    const result = await resetPasswordAction(
      INITIAL_AUTH_ACTION_STATE,
      formDataOf(VALID_RESET_FIELDS),
    );

    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.message.toLowerCase()).toMatch(/invalid|expired/);
    }
    expect(mockAuth.updateUser).not.toHaveBeenCalled();
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("rejects mismatched passwords without checking the session or calling Supabase", async () => {
    const { resetPasswordAction } = await import("@/lib/auth/actions");

    const result = await resetPasswordAction(
      INITIAL_AUTH_ACTION_STATE,
      formDataOf({
        password: "a brand new long password",
        confirmPassword: "a totally different password",
      }),
    );

    expect(result.status).toBe("error");
    expect(mockAuth.getClaims).not.toHaveBeenCalled();
    expect(mockAuth.updateUser).not.toHaveBeenCalled();
  });

  it("never returns a raw Supabase error for an update failure", async () => {
    const { resetPasswordAction } = await import("@/lib/auth/actions");
    mockAuth.getClaims.mockResolvedValue({
      data: { claims: { sub: "user-1" } },
      error: null,
    });
    mockAuth.updateUser.mockResolvedValue({
      data: null,
      error: new AuthApiError(
        "raw internal supabase detail",
        422,
        "same_password",
      ),
    });

    const result = await resetPasswordAction(
      INITIAL_AUTH_ACTION_STATE,
      formDataOf(VALID_RESET_FIELDS),
    );

    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.message).not.toContain("raw internal supabase detail");
    }
  });
});
