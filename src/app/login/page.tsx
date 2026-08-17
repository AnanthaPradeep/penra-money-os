import type { Metadata } from "next";

import { AuthPageShell } from "@/components/auth/AuthPageShell";
import { LoginForm } from "@/components/auth/LoginForm";
import { FormMessage } from "@/components/ui/FormMessage";
import { getSafeRedirectPath } from "@/lib/auth/redirect";

export const metadata: Metadata = {
  title: "Log in — PENRA Money OS",
  description: "Log in to your private PENRA Money OS account.",
};

type LoginPageProps = {
  searchParams: Promise<{
    next?: string | string[];
    error?: string | string[];
    resetSuccess?: string | string[];
  }>;
};

/** Safe, generic copy only — never a raw Supabase error string. */
const ERROR_MESSAGES: Record<string, string> = {
  verification_failed:
    "This link is invalid or has expired. Please request a new one.",
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;

  const nextParam = typeof params.next === "string" ? params.next : undefined;
  const next = nextParam ? getSafeRedirectPath(nextParam) : undefined;

  const errorParam =
    typeof params.error === "string" ? params.error : undefined;
  const errorMessage = errorParam
    ? (ERROR_MESSAGES[errorParam] ?? "Something went wrong. Please try again.")
    : undefined;

  const showResetSuccess = params.resetSuccess === "1";

  return (
    <AuthPageShell
      title="Log in"
      description="Access your private PENRA Money OS account."
    >
      {errorMessage ? (
        <FormMessage message={errorMessage} tone="error" />
      ) : null}
      {showResetSuccess ? (
        <FormMessage
          message="Your password has been updated. Please log in."
          tone="success"
        />
      ) : null}
      <LoginForm next={next} />
    </AuthPageShell>
  );
}
