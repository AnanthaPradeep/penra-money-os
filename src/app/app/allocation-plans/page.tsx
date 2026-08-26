import { Percent } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { IncomeAllocationPlanForm } from "@/components/wallets/IncomeAllocationPlanForm";
import { Badge } from "@/components/ui/Badge";
import { BackLink } from "@/components/ui/BackLink";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { ToastOnParam } from "@/components/ui/ToastOnParam";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { INCOME_ALLOCATION_MODES } from "@/lib/wallets/mapping";
import {
  listIncomeAllocationPlans,
  listPurposeWallets,
} from "@/lib/wallets/queries";

export const metadata: Metadata = {
  title: "Allocation plans — PENRA Money OS",
};

const MODE_LABELS: Record<(typeof INCOME_ALLOCATION_MODES)[number], string> = {
  percentage: "Percentage",
  fixed_amount: "Fixed amount",
  hybrid: "Hybrid",
  manual: "Manual",
};

export default async function AllocationPlansPage({
  searchParams,
}: Readonly<{ searchParams: Promise<{ saved?: string }> }>) {
  const { saved } = await searchParams;
  const user = await getAuthenticatedUser();
  if (!user) {
    redirect("/login?next=/app/allocation-plans");
  }

  const supabase = await createSupabaseServerClient();
  const [plans, wallets] = await Promise.all([
    listIncomeAllocationPlans(supabase, { includeArchived: true }),
    listPurposeWallets(supabase),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
      {saved === "1" ? (
        <ToastOnParam param="saved" message="Allocation plan saved." />
      ) : null}

      <PageHeader
        eyebrow={<BackLink href="/app/wallets">Back to wallets</BackLink>}
        title="Income allocation plans"
        description="A reusable template for splitting a received income transaction across your wallets. Apply a plan from the income transaction itself — it's never applied automatically."
      />

      <section aria-labelledby="plans-heading" className="flex flex-col gap-3">
        <SectionHeader id="plans-heading" title="Your plans" />
        {plans.length === 0 ? (
          <EmptyState
            icon={<Percent aria-hidden="true" className="size-6" />}
            title="No allocation plans yet"
            description="Create one below to split future income across your wallets by percentage, fixed amount, or a mix of both."
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {plans.map((plan) => (
              <li
                key={plan.id}
                className="flex items-center justify-between gap-4 rounded-lg border border-border bg-elevated px-4 py-3.5 text-sm"
              >
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium text-foreground">
                    {plan.name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {MODE_LABELS[plan.allocationMode]} · effective{" "}
                    {plan.effectiveDate}
                  </span>
                </div>
                <Badge
                  variant={
                    plan.status === "active"
                      ? "positive"
                      : plan.status === "paused"
                        ? "warning"
                        : "neutral"
                  }
                >
                  {plan.status}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </section>

      <IncomeAllocationPlanForm
        wallets={wallets.map((w) => ({ id: w.id, name: w.name }))}
      />
    </div>
  );
}
