import { PiggyBank } from "lucide-react";
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
import { goalFundedAmount } from "@/lib/goals/mapping";
import { listFinancialGoals, listGoalContributions } from "@/lib/goals/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listPurposeWallets } from "@/lib/wallets/queries";

export const metadata: Metadata = { title: "Sinking funds — PENRA Money OS" };

export default async function SinkingFundsPage() {
  const user = await getAuthenticatedUser();
  if (!user) {
    redirect("/login?next=/app/sinking-funds");
  }

  const supabase = await createSupabaseServerClient();
  const [goals, wallets] = await Promise.all([
    listFinancialGoals(supabase, { goalType: "sinking_fund" }),
    listPurposeWallets(supabase),
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
        title="Sinking funds"
        description="Save toward a known, recurring, or upcoming expense in regular instalments — a car service, an annual premium, a festival season."
      />

      {goals.length === 0 ? (
        <EmptyState
          icon={<PiggyBank aria-hidden="true" className="size-6" />}
          title="No sinking funds yet"
          description="Set one up below with a target amount, a due date, and a contribution frequency."
        />
      ) : (
        <section aria-labelledby="sf-heading" className="flex flex-col gap-3">
          <SectionHeader id="sf-heading" title="Your sinking funds" />
          <ul className="flex flex-col gap-2">
            {goals.map((goal) => {
              const funded = fundedByGoal.get(goal.id);
              return (
                <li key={goal.id}>
                  <Link
                    href={`/app/goals/${goal.id}`}
                    className="flex items-center justify-between gap-4 rounded-lg border border-border bg-elevated px-4 py-3.5 transition-colors hover:border-input-border"
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium text-foreground">
                        {goal.name}
                      </span>
                      {goal.targetDate ? (
                        <span className="text-xs text-muted-foreground">
                          Due {goal.targetDate}
                        </span>
                      ) : null}
                    </div>
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

      <section aria-labelledby="sf-new-heading" className="flex flex-col gap-3">
        <SectionHeader id="sf-new-heading" title="Set up a sinking fund" />
        <GoalForm
          wallets={wallets.map((w) => ({ id: w.id, name: w.name }))}
          defaultGoalType="sinking_fund"
        />
      </section>
    </div>
  );
}
