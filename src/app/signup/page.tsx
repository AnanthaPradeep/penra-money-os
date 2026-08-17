import type { Metadata } from "next";

import { AuthPageShell } from "@/components/auth/AuthPageShell";
import { SignupForm } from "@/components/auth/SignupForm";
import { getSafeRedirectPath } from "@/lib/auth/redirect";

export const metadata: Metadata = {
  title: "Sign up — PENRA Money OS",
  description: "Create your private PENRA Money OS account.",
};

type SignupPageProps = {
  searchParams: Promise<{ next?: string | string[] }>;
};

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const params = await searchParams;
  const nextParam = typeof params.next === "string" ? params.next : undefined;
  const next = nextParam ? getSafeRedirectPath(nextParam) : undefined;

  return (
    <AuthPageShell
      title="Create your account"
      description="Set up your private PENRA Money OS account."
    >
      <SignupForm next={next} />
    </AuthPageShell>
  );
}
