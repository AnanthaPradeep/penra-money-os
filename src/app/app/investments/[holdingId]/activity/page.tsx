import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { ActivityComposer } from "@/components/investments/ActivityComposer";
import { PageHeader } from "@/components/ui/PageHeader";
import { listAccountsWithBalances } from "@/lib/accounts/queries";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { listCategories } from "@/lib/categories/queries";
import {
  getHoldingSummaryById,
  getInvestmentAssetById,
  getInvestmentHoldingById,
} from "@/lib/investments/queries";
import { supportedActivityKindsForAssetKind } from "@/lib/investments/types";
import { listPayees } from "@/lib/payees/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type RecordActivityPageProps = {
  params: Promise<{ holdingId: string }>;
};

export const metadata: Metadata = {
  title: "Record activity — PENRA Money OS",
};

export default async function RecordActivityPage({
  params,
}: Readonly<RecordActivityPageProps>) {
  const { holdingId } = await params;

  const user = await getAuthenticatedUser();
  if (!user) {
    redirect(`/login?next=/app/investments/${holdingId}/activity`);
  }

  const supabase = await createSupabaseServerClient();
  const holding = await getInvestmentHoldingById(supabase, holdingId);
  if (!holding) {
    notFound();
  }
  if (holding.status !== "active") {
    notFound();
  }

  const [
    asset,
    summary,
    accountsWithBalances,
    incomeCategoriesRaw,
    expenseCategoriesRaw,
    payeesRaw,
  ] = await Promise.all([
    getInvestmentAssetById(supabase, holding.investmentAssetId),
    getHoldingSummaryById(supabase, holdingId),
    listAccountsWithBalances(supabase),
    listCategories(supabase, "income"),
    listCategories(supabase, "expense"),
    listPayees(supabase),
  ]);

  if (!asset || !summary) {
    notFound();
  }

  const accounts = accountsWithBalances
    .filter((a) => !a.isArchived)
    .map((a) => ({
      id: a.id,
      name: a.name,
      accountType: a.accountType,
      displayBalance: a.displayBalance.toString(),
    }));
  const incomeCategories = incomeCategoriesRaw.map((c) => ({
    id: c.id,
    name: c.name,
  }));
  const expenseCategories = expenseCategoriesRaw.map((c) => ({
    id: c.id,
    name: c.name,
  }));
  const payees = payeesRaw.map((p) => ({ id: p.id, name: p.name }));

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
      <PageHeader
        title={`Record activity — ${asset.displayName}`}
        description="Purchases, sales, contributions, withdrawals, dividends, interest, and fees all reconcile with your ledger automatically."
      />
      <ActivityComposer
        holdingId={holdingId}
        supportedKinds={supportedActivityKindsForAssetKind(asset.assetKind)}
        accounts={accounts}
        incomeCategories={incomeCategories}
        expenseCategories={expenseCategories}
        payees={payees}
        idempotencyKey={crypto.randomUUID()}
        availableQuantity={
          summary.quantity.greaterThan(0) ||
          asset.assetKind === "stock" ||
          asset.assetKind === "mutual_fund"
            ? summary.quantity.toString()
            : null
        }
        availableBalance={summary.costBasis.toString()}
      />
    </div>
  );
}
