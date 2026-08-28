import { ShieldAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { GoalForm } from "@/components/goals/GoalForm";
import { AmountDisplay } from "@/components/ui/AmountDisplay";
import { BackLink } from "@/components/ui/BackLink";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { listCategories } from "@/lib/categories/queries";
import { goalFundedAmount } from "@/lib/goals/mapping";
import { listFinancialGoals, listGoalContributions } from "@/lib/goals/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listPurposeWallets } from "@/lib/wallets/queries";

export const metadata: Metadata = { title: "Emergency fund — PENRA Money OS" };

export default async function EmergencyFundPage() {
  const user = await getAuthenticatedUser();
  if (!user) {
    redirect("/login?next=/app/emergency-fund");
  }

  const supabase = await createSupabaseServerClient();
  const [goals, wallets, expenseCategories] = await Promise.all([
    listFinancialGoals(supabase, { goalType: "emergency_fund" }),
    listPurposeWallets(supabase),
    listCategories(supabase, "expense"),
  ]);

  const fundedByGoal = new Map<string, ReturnType<typeof goalFundedAmount>>();
  await Promise.all(
    goals.map(async (goal) => {
      const contributions = await listGoalContributions(supabase, goal.id);
      fundedByGoal.set(goal.id, goalFundedAmount(contributions));
    }),
  );

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
      <PageHeader
        eyebrow={<BackLink href="/app/goals">Back to goals</BackLink>}
        title="Emergency fund"
        description="A safety net you set aside deliberately — either a fixed target, or a number of months of essential expenses you confirm yourself. Never inferred automatically."
      />

      {goals.length === 0 ? (
        <EmptyState
          icon={<ShieldAlert aria-hidden="true" className="size-6" />}
          title="No emergency fund yet"
          description="Set a target below to start tracking progress."
        />
      ) : (
        <section aria-labelledby="ef-heading" className="flex flex-col gap-3">
          <SectionHeader id="ef-heading" title="Your emergency funds" />
          <ul className="flex flex-col gap-2">
            {goals.map((goal) => {
              const funded = fundedByGoal.get(goal.id);
              return (
                <li key={goal.id}>
                  <Link
                    href={`/app/goals/${goal.id}`}
                    className="flex items-center justify-between gap-4 rounded-lg border border-border bg-elevated px-4 py-3.5 transition-colors hover:border-input-border"
                  >
                    <span className="text-sm font-medium text-foreground">
                      {goal.name}
                    </span>
                    <div className="flex flex-col items-end gap-0.5">
                      <AmountDisplay value={funded ?? "0"} size="sm" />
                      <span className="text-xs text-muted-foreground">
                        of {goal.targetAmount.toString()}
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section aria-labelledby="ef-new-heading" className="flex flex-col gap-3">
        <SectionHeader id="ef-new-heading" title="Set up an emergency fund" />
        <GoalForm
          wallets={wallets.map((w) => ({ id: w.id, name: w.name }))}
          defaultGoalType="emergency_fund"
          expenseCategories={expenseCategories.map((c) => ({
            id: c.id,
            name: c.name,
          }))}
        />
      </section>
    </div>
  );
}
