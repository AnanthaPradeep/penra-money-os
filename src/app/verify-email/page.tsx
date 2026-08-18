import type { Metadata } from "next";

import { AuthPageShell } from "@/components/auth/AuthPageShell";
import { ResendVerificationForm } from "@/components/auth/ResendVerificationForm";

export const metadata: Metadata = {
  title: "Verify your email — PENRA Money OS",
  description: "Check your inbox to confirm your email address.",
};

export default function VerifyEmailPage() {
  return (
    <AuthPageShell title="Check your inbox">
      <p className="text-sm text-muted-foreground">
        We&rsquo;ve sent a confirmation link to the email address you signed up
        with. Open it to activate your account. If you don&rsquo;t see it within
        a few minutes, check your spam folder.
      </p>

      <div className="flex flex-col gap-3 border-t border-border pt-5">
        <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          Didn&rsquo;t get an email?
        </h2>
        <ResendVerificationForm />
      </div>
    </AuthPageShell>
  );
}
