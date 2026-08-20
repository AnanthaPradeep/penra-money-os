import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { NewInvestmentForm } from "@/components/investments/NewInvestmentForm";
import { PageHeader } from "@/components/ui/PageHeader";
import { listAccountsWithBalances } from "@/lib/accounts/queries";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "New investment — PENRA Money OS",
};

export default async function NewInvestmentPage() {
  const user = await getAuthenticatedUser();
  if (!user) {
    redirect("/login?next=/app/investments/new");
  }

  const supabase = await createSupabaseServerClient();
  const accountsWithBalances = await listAccountsWithBalances(supabase);
  const activeAccounts = accountsWithBalances.filter((a) => !a.isArchived);

  const investmentAccounts = activeAccounts
    .filter((a) => a.accountType === "investment")
    .map((a) => ({
      id: a.id,
      name: a.name,
      accountType: a.accountType,
      displayBalance: a.displayBalance.toString(),
    }));
  const fundingAccounts = activeAccounts
    .filter((a) => a.accountType !== "investment")
    .map((a) => ({
      id: a.id,
      name: a.name,
      accountType: a.accountType,
      displayBalance: a.displayBalance.toString(),
    }));

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
      <PageHeader
        title="New investment"
        description="Track a stock, mutual fund, PPF, fixed deposit, recurring deposit, or another investment."
      />
      <NewInvestmentForm
        investmentAccounts={investmentAccounts}
        fundingAccounts={fundingAccounts}
        fixedDepositIdempotencyKey={crypto.randomUUID()}
        ppfOpeningContributionIdempotencyKey={crypto.randomUUID()}
      />
    </div>
  );
}
