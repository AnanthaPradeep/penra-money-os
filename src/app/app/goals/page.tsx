import { PlusCircle, Target } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AmountDisplay } from "@/components/ui/AmountDisplay";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { GOAL_TYPE_LABELS, goalFundedAmount } from "@/lib/goals/mapping";
import { listFinancialGoals, listGoalContributions } from "@/lib/goals/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Goals — PENRA Money OS" };

export default async function GoalsPage() {
  const user = await getAuthenticatedUser();
  if (!user) {
    redirect("/login?next=/app/goals");
  }

  const supabase = await createSupabaseServerClient();
  const goals = await listFinancialGoals(supabase, { includeArchived: true });

  const fundedByGoal = new Map<string, ReturnType<typeof goalFundedAmount>>();
  await Promise.all(
    goals.map(async (goal) => {
      const contributions = await listGoalContributions(supabase, goal.id);
      fundedByGoal.set(goal.id, goalFundedAmount(contributions));
    }),
  );

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Goals"
        description="Track savings goals — including your emergency fund and sinking funds — without assuming a return or guaranteeing a payoff date."
        actions={
          <Button asChild>
            <Link href="/app/goals/new">
              <PlusCircle aria-hidden="true" className="size-4" />
              New goal
            </Link>
          </Button>
        }
      />

      {goals.length === 0 ? (
        <EmptyState
          icon={<Target aria-hidden="true" className="size-6" />}
          title="No goals yet"
          description="Create a goal to track progress toward an emergency fund, a big purchase, or anything else you're saving for."
          action={
            <Button asChild>
              <Link href="/app/goals/new">
                <PlusCircle aria-hidden="true" className="size-4" />
                Create your first goal
              </Link>
            </Button>
          }
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {goals.map((goal) => {
            const funded = fundedByGoal.get(goal.id);
            const percent = funded
              ? Math.min(
                  100,
                  Math.round(
                    Number(funded.dividedBy(goal.targetAmount).times(100)),
                  ),
                )
              : 0;
            return (
              <li key={goal.id}>
                <Link
                  href={`/app/goals/${goal.id}`}
                  className="flex items-center justify-between gap-4 rounded-lg border border-border bg-elevated px-4 py-3.5 transition-colors hover:border-input-border"
                >
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="flex items-center gap-2 truncate text-sm font-medium text-foreground">
                      {goal.name}
                      <StatusBadge status={goal.status} />
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {GOAL_TYPE_LABELS[goal.goalType]} · {percent}% funded
                    </span>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-0.5">
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
      )}
    </div>
  );
}
