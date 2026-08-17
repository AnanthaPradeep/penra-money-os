import type { Metadata } from "next";

import { AuthPageShell } from "@/components/auth/AuthPageShell";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";

export const metadata: Metadata = {
  title: "Forgot password — PENRA Money OS",
  description: "Request a password reset link.",
};

export default function ForgotPasswordPage() {
  return (
    <AuthPageShell
      title="Forgot your password?"
      description="Enter your email and we'll send you a link to reset it."
    >
      <ForgotPasswordForm />
    </AuthPageShell>
  );
}
