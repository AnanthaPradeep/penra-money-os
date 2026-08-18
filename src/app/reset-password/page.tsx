import type { Metadata } from "next";
import Link from "next/link";

import { AuthPageShell } from "@/components/auth/AuthPageShell";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";
import { FormMessage } from "@/components/ui/FormMessage";
import { getAuthenticatedUser } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Reset password — PENRA Money OS",
  description: "Set a new password for your account.",
};

/**
 * Deliberately NOT protected by Proxy's `/app/*` gate, and deliberately NOT
 * redirected away for an authenticated user the way `/login`/`/signup` are
 * (see src/proxy.ts) — a password-recovery link establishes a real
 * authenticated session, and this page IS how that session gets used. The
 * check below is this page's own authorization: a valid session must
 * exist (recovery or otherwise), or the link is treated as invalid/expired.
 */
export default async function ResetPasswordPage() {
  const user = await getAuthenticatedUser();

  if (!user) {
    return (
      <AuthPageShell title="Link invalid or expired">
        <FormMessage
          message="This password reset link is invalid or has expired. Please request a new one."
          tone="error"
        />
        <Link
          href="/forgot-password"
          className="text-sm font-medium text-primary underline-offset-2 hover:underline"
        >
          Request a new link
        </Link>
      </AuthPageShell>
    );
  }

  return (
    <AuthPageShell
      title="Set a new password"
      description="Choose a new password for your account."
    >
      <ResetPasswordForm />
    </AuthPageShell>
  );
}
