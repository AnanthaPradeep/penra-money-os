import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { DebtForm } from "@/components/debts/DebtForm";
import { listAccountsWithBalances } from "@/lib/accounts/queries";
import { BackLink } from "@/components/ui/BackLink";
import { PageHeader } from "@/components/ui/PageHeader";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "New debt — PENRA Money OS" };

export default async function NewDebtPage() {
  const user = await getAuthenticatedUser();
  if (!user) {
    redirect("/login?next=/app/debts/new");
  }

  const supabase = await createSupabaseServerClient();
  const accounts = await listAccountsWithBalances(supabase);
  const liabilityAccounts = accounts.filter(
    (a) => a.accountClass === "liability",
  );

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <PageHeader
        eyebrow={<BackLink href="/app/debts">Back to debts</BackLink>}
        title="New debt"
        description="Track a loan, credit card, or money you've borrowed. Interest rates are never assumed — you enter the actual terms."
      />
      <DebtForm
        liabilityAccounts={liabilityAccounts.map((a) => ({
          id: a.id,
          name: a.name,
        }))}
      />
    </div>
  );
}
