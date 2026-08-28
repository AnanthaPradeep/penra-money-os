import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { GoalAccountLinkForm } from "@/components/goals/GoalAccountLinkForm";
import { GoalContributionForms } from "@/components/goals/GoalContributionForms";
import { GoalMilestoneForm } from "@/components/goals/GoalMilestoneForm";
import { GoalStatusForm } from "@/components/goals/GoalStatusForm";
import { SinkingFundRecurringItemForm } from "@/components/goals/SinkingFundRecurringItemForm";
import { listAccountsWithBalances } from "@/lib/accounts/queries";
import { AmountDisplay } from "@/components/ui/AmountDisplay";
import { BackLink } from "@/components/ui/BackLink";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ToastOnParam } from "@/components/ui/ToastOnParam";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { formatIstDateTime } from "@/lib/dates/timezone";
import { GOAL_TYPE_LABELS, goalFundedAmount } from "@/lib/goals/mapping";
import { getGoalDetail } from "@/lib/goals/queries";
import { listRecurringItems } from "@/lib/recurring/queries";
import { RECURRING_ITEM_KIND_LABELS } from "@/lib/recurring/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type GoalDetailPageProps = {
  params: Promise<{ goalId: string }>;
  searchParams: Promise<{ created?: string }>;
};

export const metadata: Metadata = { title: "Goal — PENRA Money OS" };

export default async function GoalDetailPage({
  params,
  searchParams,
}: Readonly<GoalDetailPageProps>) {
  const { goalId } = await params;
  const { created } = await searchParams;

  const user = await getAuthenticatedUser();
  if (!user) {
    redirect(`/login?next=/app/goals/${goalId}`);
  }

  const supabase = await createSupabaseServerClient();
  const [detail, accounts, recurringItems] = await Promise.all([
    getGoalDetail(supabase, goalId),
    listAccountsWithBalances(supabase),
    listRecurringItems(supabase, { status: "active" }),
  ]);

  if (!detail) {
    notFound();
  }

  const { goal, contributions, milestones, accountLinks } = detail;
  const linkedAccounts = accountLinks
    .map((link) => accounts.find((a) => a.id === link.accountId))
    .filter((a): a is (typeof accounts)[number] => a !== undefined);
  const funded = goalFundedAmount(contributions);
  const remaining = goal.targetAmount.minus(funded);
  const percent = Math.min(
    100,
    Math.max(
      0,
      Math.round(Number(funded.dividedBy(goal.targetAmount).times(100))),
    ),
  );

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      {created === "1" ? (
        <ToastOnParam param="created" message="Goal created." />
      ) : null}

      <PageHeader
        eyebrow={<BackLink href="/app/goals">Back to goals</BackLink>}
        title={goal.name}
        description={GOAL_TYPE_LABELS[goal.goalType]}
        actions={<StatusBadge status={goal.status} />}
      />

      <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-5">
        <div className="flex items-baseline justify-between">
          <AmountDisplay value={funded} size="xl" />
          <span className="text-sm text-muted-foreground">
            of {goal.targetAmount.toString()}
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted-surface">
          <div
            className="h-full rounded-full bg-primary"
            style={{ width: `${percent}%` }}
          />
        </div>
        <span className="text-sm text-muted-foreground">
          {percent}% funded
          {remaining.gt(0)
            ? ` · ${remaining.toString()} remaining`
            : " · target reached"}
          {goal.targetDate ? ` · target date ${goal.targetDate}` : ""}
        </span>
        {goal.efTargetMethod === "months_of_expenses" &&
        goal.efEssentialMonthlyExpense &&
        goal.efTargetMonths ? (
          <span className="text-xs text-muted-foreground">
            Based on {goal.efTargetMonths} months of your{" "}
            {goal.efEssentialCategoryIds && goal.efEssentialCategoryIds.length > 0
              ? "category-calculated"
              : "confirmed"}{" "}
            {goal.efEssentialMonthlyExpense.toString()}/month essential
            expense
            {goal.efEssentialPeriodStart && goal.efEssentialPeriodEnd
              ? ` (calculated from ${goal.efEssentialPeriodStart} to ${goal.efEssentialPeriodEnd})`
              : ""}
            .
          </span>
        ) : null}
      </div>

      <GoalStatusForm goalId={goal.id} status={goal.status} />

      <section
        aria-labelledby="linked-accounts-heading"
        className="flex flex-col gap-3"
      >
        <SectionHeader id="linked-accounts-heading" title="Linked accounts" />
        <p className="text-xs text-muted-foreground">
          Informational only — linking a real account here never changes
          how contributions are recorded or adds to this goal&apos;s
          progress automatically.
        </p>
        <GoalAccountLinkForm
          goalId={goal.id}
          accounts={accounts.map((a) => ({ id: a.id, name: a.name }))}
          linkedAccounts={linkedAccounts.map((a) => ({ id: a.id, name: a.name }))}
        />
      </section>

      {goal.goalType === "sinking_fund" ? (
        <section
          aria-labelledby="linked-recurring-heading"
          className="flex flex-col gap-3"
        >
          <SectionHeader
            id="linked-recurring-heading"
            title="Linked recurring item"
          />
          <p className="text-xs text-muted-foreground">
            The bill, premium, or subscription this sinking fund is saving
            toward — informational only, it never changes how either this
            goal or the recurring item itself is processed.
          </p>
          <SinkingFundRecurringItemForm
            goalId={goal.id}
            recurringItems={recurringItems.map((item) => ({
              id: item.id,
              name: item.name,
              kindLabel: RECURRING_ITEM_KIND_LABELS[item.kind],
            }))}
            linkedRecurringItemId={goal.sfLinkedRecurringItemId}
          />
        </section>
      ) : null}

      {goal.status === "active" || goal.status === "draft" ? (
        <GoalContributionForms
          goalId={goal.id}
          hasLinkedWallet={goal.purposeWalletId !== null}
          accounts={accounts.map((a) => ({ id: a.id, name: a.name }))}
          allocationIdempotencyKey={crypto.randomUUID()}
          transferIdempotencyKey={crypto.randomUUID()}
        />
      ) : null}

      <section
        aria-labelledby="contributions-heading"
        className="flex flex-col gap-3"
      >
        <SectionHeader
          id="contributions-heading"
          title="Contribution history"
        />
        {contributions.length === 0 ? (
          <EmptyState
            title="No contributions yet"
            description="Contributions and withdrawals recorded against this goal will appear here."
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {contributions.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between gap-4 rounded-lg border border-border bg-elevated px-4 py-3.5 text-sm"
              >
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium text-foreground">
                    {c.direction === "contribution"
                      ? "Contribution"
                      : "Withdrawal"}
                    {c.status === "reversed" ? " (reversed)" : ""}
                    {c.contributionType === "account_transfer"
                      ? " · transfer"
                      : " · earmarked"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatIstDateTime(c.occurredAt)}
                  </span>
                </div>
                <AmountDisplay
                  value={
                    c.direction === "contribution"
                      ? c.amount
                      : c.amount.negated()
                  }
                  variant="signed"
                  size="sm"
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section
        aria-labelledby="milestones-heading"
        className="flex flex-col gap-3"
      >
        <SectionHeader id="milestones-heading" title="Milestones" />
        {milestones.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {milestones.map((m) => (
              <li
                key={m.id}
                className="flex items-center justify-between gap-4 rounded-lg border border-border bg-elevated px-4 py-3.5 text-sm"
              >
                <span className="font-medium text-foreground">{m.name}</span>
                <span className="text-muted-foreground">
                  {m.targetAmount.toString()}
                  {m.achievedAt ? " · achieved" : ""}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            title="No milestones yet"
            description="Add a checkpoint to track progress toward this goal, e.g. 'Halfway there'."
          />
        )}
        <GoalMilestoneForm goalId={goal.id} />
      </section>
    </div>
  );
}
