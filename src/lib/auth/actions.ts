"use server";

import { redirect } from "next/navigation";
import type { z } from "zod";

import type { AuthActionState } from "@/lib/auth/action-state";
import { logAuthError, normalizeAuthError } from "@/lib/auth/errors";
import { buildAppUrl, getSafeRedirectPath } from "@/lib/auth/redirect";
import {
  forgotPasswordSchema,
  loginSchema,
  resendVerificationSchema,
  resetPasswordSchema,
  signupSchema,
} from "@/lib/auth/schemas";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const GENERIC_VALIDATION_MESSAGE = "Please fix the highlighted fields.";

function readFormString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function fieldErrorsFromZod(error: z.ZodError): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    if (!(key in fieldErrors)) {
      fieldErrors[key] = issue.message;
    }
  }
  return fieldErrors;
}

/** Builds an absolute `emailRedirectTo`/`redirectTo` URL with a safe `next` query param. */
function buildAuthCallbackUrl(next: string): string {
  const url = new URL(buildAppUrl("/auth/callback"));
  url.searchParams.set("next", next);
  return url.toString();
}

export async function signUpAction(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = signupSchema.safeParse({
    displayName: readFormString(formData, "displayName"),
    email: readFormString(formData, "email"),
    password: readFormString(formData, "password"),
    confirmPassword: readFormString(formData, "confirmPassword"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: GENERIC_VALIDATION_MESSAGE,
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  const { displayName, email, password } = parsed.data;
  const next = getSafeRedirectPath(readFormString(formData, "next"));

  const supabase = await createSupabaseServerClient();

  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName },
        emailRedirectTo: buildAuthCallbackUrl(next),
      },
    });

    if (error) {
      // Do not reveal whether the email already exists beyond Supabase's
      // own safe intended behaviour: an "already exists" outcome falls
      // through to the same "check your inbox" redirect below, never a
      // distinct error — this branch only handles genuine failures (rate
      // limiting, disabled signups, etc.).
      if (
        error.code !== "user_already_exists" &&
        error.code !== "email_exists"
      ) {
        logAuthError("signup", error);
        return { status: "error", message: normalizeAuthError(error).message };
      }
    }

    // A session here means email confirmation is not required in this
    // project's current configuration (e.g. a local/test setup) — sign
    // the user in immediately rather than sending them to a verification
    // screen they don't need.
    if (data?.session) {
      redirect(next);
    }
  } catch (unexpected) {
    if (isNextRedirectError(unexpected)) {
      throw unexpected;
    }
    logAuthError("signup", unexpected);
    return { status: "error", message: normalizeAuthError(unexpected).message };
  }

  redirect("/verify-email");
}

export async function logInAction(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = loginSchema.safeParse({
    email: readFormString(formData, "email"),
    password: readFormString(formData, "password"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: GENERIC_VALIDATION_MESSAGE,
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  const next = getSafeRedirectPath(readFormString(formData, "next"));
  const supabase = await createSupabaseServerClient();

  try {
    const { error } = await supabase.auth.signInWithPassword(parsed.data);

    if (error) {
      logAuthError("login", error);
      return { status: "error", message: normalizeAuthError(error).message };
    }
  } catch (unexpected) {
    if (isNextRedirectError(unexpected)) {
      throw unexpected;
    }
    logAuthError("login", unexpected);
    return { status: "error", message: normalizeAuthError(unexpected).message };
  }

  redirect(next);
}

/**
 * Plain Server Action for a `<form action={logOutAction}>` — no field
 * validation or pending-state payload needed beyond the shared
 * `SubmitButton`'s own `useFormStatus`-driven pending state.
 */
export async function logOutAction(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}

const RESEND_VERIFICATION_MESSAGE =
  "If an account exists for that email, we've sent a new confirmation link.";

export async function resendVerificationAction(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = resendVerificationSchema.safeParse({
    email: readFormString(formData, "email"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Please enter a valid email address.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: parsed.data.email,
      options: { emailRedirectTo: buildAuthCallbackUrl("/app") },
    });

    if (error) {
      logAuthError("resend-verification", error);
      const { kind, message } = normalizeAuthError(error);
      // Only rate-limit / configuration failures are surfaced distinctly —
      // neither reveals whether the account exists. Every other outcome
      // (including "no such pending signup") shows the same generic
      // success-shaped message below, to avoid account enumeration.
      if (kind === "rate_limited" || kind === "config_unavailable") {
        return { status: "error", message };
      }
    }
  } catch (unexpected) {
    logAuthError("resend-verification", unexpected);
    // Even an unexpected failure does not get a distinct message here —
    // see the enumeration note above.
  }

  return { status: "success", message: RESEND_VERIFICATION_MESSAGE };
}

const FORGOT_PASSWORD_MESSAGE =
  "If an account exists for that email, password reset instructions will be sent.";

export async function forgotPasswordAction(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = forgotPasswordSchema.safeParse({
    email: readFormString(formData, "email"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Please enter a valid email address.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.resetPasswordForEmail(
      parsed.data.email,
      { redirectTo: buildAuthCallbackUrl("/reset-password") },
    );

    if (error) {
      logAuthError("forgot-password", error);
      const { kind, message } = normalizeAuthError(error);
      // Same enumeration-safety reasoning as resendVerificationAction above.
      if (kind === "rate_limited" || kind === "config_unavailable") {
        return { status: "error", message };
      }
    }
  } catch (unexpected) {
    logAuthError("forgot-password", unexpected);
  }

  return { status: "success", message: FORGOT_PASSWORD_MESSAGE };
}

export async function resetPasswordAction(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = resetPasswordSchema.safeParse({
    password: readFormString(formData, "password"),
    confirmPassword: readFormString(formData, "confirmPassword"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: GENERIC_VALIDATION_MESSAGE,
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  const supabase = await createSupabaseServerClient();

  // Verify a real authenticated/recovery session exists before accepting
  // the update — never assume arriving on this page implies one does.
  const { data: claimsData, error: claimsError } =
    await supabase.auth.getClaims();

  if (claimsError || !claimsData?.claims) {
    return {
      status: "error",
      message: "This link is invalid or has expired. Please request a new one.",
    };
  }

  try {
    const { error } = await supabase.auth.updateUser({
      password: parsed.data.password,
    });

    if (error) {
      logAuthError("reset-password", error);
      return { status: "error", message: normalizeAuthError(error).message };
    }
  } catch (unexpected) {
    if (isNextRedirectError(unexpected)) {
      throw unexpected;
    }
    logAuthError("reset-password", unexpected);
    return { status: "error", message: normalizeAuthError(unexpected).message };
  }

  try {
    await supabase.auth.signOut();
  } catch (unexpected) {
    // Non-fatal — the password update already succeeded above; the
    // client's now-stale session simply won't pass verification on the
    // next server-side check either way.
    logAuthError("reset-password-signout", unexpected);
  }

  redirect("/login?resetSuccess=1");
}

/**
 * `redirect()` from `next/navigation` works by throwing a special,
 * digest-tagged error that Next's own rendering machinery catches
 * upstream. A `catch` block wrapping a call site that also calls
 * `redirect()` must re-throw this specific error rather than treating it
 * as a real failure.
 */
function isNextRedirectError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest?: unknown }).digest === "string" &&
    (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}
