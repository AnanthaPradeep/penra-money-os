import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { TaxProfileForm } from "@/components/tax/TaxProfileForm";
import { BackLink } from "@/components/ui/BackLink";
import { PageHeader } from "@/components/ui/PageHeader";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { getTaxProfile } from "@/lib/tax/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Tax profile — PENRA Money OS" };

export default async function TaxProfilePage() {
  const user = await getAuthenticatedUser();
  if (!user) {
    redirect("/login?next=/app/tax/profile");
  }

  const supabase = await createSupabaseServerClient();
  const profile = await getTaxProfile(supabase);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <PageHeader
        eyebrow={<BackLink href="/app/tax">Back to tax workspace</BackLink>}
        title="Tax profile"
        description="Tells PENRA which automated estimates apply to you. This is planning information only — never submitted anywhere, never shared, and never used to file anything on your behalf."
      />
      <TaxProfileForm profile={profile} />
    </div>
  );
}
