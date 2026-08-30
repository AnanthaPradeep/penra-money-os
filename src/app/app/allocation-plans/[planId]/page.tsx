import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { IncomeAllocationPlanForm } from "@/components/wallets/IncomeAllocationPlanForm";
import { BackLink } from "@/components/ui/BackLink";
import { PageHeader } from "@/components/ui/PageHeader";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { listAccountsWithBalances } from "@/lib/accounts/queries";
import { listCategories } from "@/lib/categories/queries";
import { listPayees } from "@/lib/payees/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getIncomeAllocationPlanWithLines,
  listPurposeWallets,
} from "@/lib/wallets/queries";

export const metadata: Metadata = {
  title: "Edit allocation plan — PENRA Money OS",
};

type EditAllocationPlanPageProps = {
  params: Promise<{ planId: string }>;
};

export default async function EditAllocationPlanPage({
  params,
}: Readonly<EditAllocationPlanPageProps>) {
  const { planId } = await params;
  const user = await getAuthenticatedUser();
  if (!user) {
    redirect(`/login?next=/app/allocation-plans/${planId}`);
  }

  const supabase = await createSupabaseServerClient();
  const planWithLines = await getIncomeAllocationPlanWithLines(
    supabase,
    planId,
  );
  if (!planWithLines) {
    notFound();
  }

  const [wallets, incomeCategories, payees, accounts] = await Promise.all([
    listPurposeWallets(supabase),
    listCategories(supabase, "income"),
    listPayees(supabase),
    listAccountsWithBalances(supabase),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
      <PageHeader
        eyebrow={
          <BackLink href="/app/allocation-plans">
            Back to allocation plans
          </BackLink>
        }
        title={`Edit ${planWithLines.plan.name}`}
        description="Changes apply the next time this plan is used — past applications of this plan to income transactions are never rewritten."
      />

      <IncomeAllocationPlanForm
        wallets={wallets.map((w) => ({ id: w.id, name: w.name }))}
        categories={incomeCategories.map((c) => ({ id: c.id, name: c.name }))}
        payees={payees.map((p) => ({ id: p.id, name: p.name }))}
        accounts={accounts.map((a) => ({ id: a.id, name: a.name }))}
        editingPlan={planWithLines.plan}
        editingLines={planWithLines.lines}
      />
    </div>
  );
}
