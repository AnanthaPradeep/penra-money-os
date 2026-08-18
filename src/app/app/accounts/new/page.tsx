import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AccountForm } from "@/components/accounts/AccountForm";
import { BackLink } from "@/components/ui/BackLink";
import { PageHeader } from "@/components/ui/PageHeader";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { listInstitutions } from "@/lib/institutions/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "New account — PENRA Money OS",
};

export default async function NewAccountPage() {
  const user = await getAuthenticatedUser();
  if (!user) {
    redirect("/login?next=/app/accounts/new");
  }

  const supabase = await createSupabaseServerClient();
  const institutions = await listInstitutions(supabase);

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <PageHeader
        eyebrow={<BackLink href="/app/accounts">Back to accounts</BackLink>}
        title="New account"
        description="Bank, cash, wallet, credit card, or loan — add the accounts you actually use."
      />
      <AccountForm institutions={institutions} />
    </div>
  );
}
