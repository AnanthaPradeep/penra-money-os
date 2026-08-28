import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { BudgetAllocationsForm } from "@/components/budgets/BudgetAllocationsForm";
import { CategoryProgressRow } from "@/components/budgets/CategoryProgressRow";
import { CopyPreviousMonthButton } from "@/components/budgets/CopyPreviousMonthButton";
import { MonthSelector } from "@/components/budgets/MonthSelector";
import { AmountDisplay } from "@/components/ui/AmountDisplay";
import { Card, CardContent } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { SectionHeader } from "@/components/ui/SectionHeader";
import {
  getBudgetCategoryProgress,
  getBudgetSummary,
  getOrCreateBudgetPeriod,
  getUnbudgetedExpenses,
} from "@/lib/budgets/queries";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { listCategories } from "@/lib/categories/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type BudgetMonthPageProps = {
  params: Promise<{ month: string }>;
};

export const metadata: Metadata = {
  title: "Budget — PENRA Money OS",
};

const MONTH_PARAM_PATTERN = /^\d{4}-\d{2}$/;

function addMonths(month: string, months: number): string {
  const [year, monthNum] = month.split("-").map(Number);
  const date = new Date(
    Date.UTC(year ?? 1970, (monthNum ?? 1) - 1 + months, 1),
  );
  return date.toISOString().slice(0, 7);
}

export default async function BudgetMonthPage({
  params,
}: Readonly<BudgetMonthPageProps>) {
  const { month } = await params;

  if (!MONTH_PARAM_PATTERN.test(month)) {
    notFound();
  }

  const user = await getAuthenticatedUser();
  if (!user) {
    redirect(`/login?next=/app/budgets/${month}`);
  }

  const periodMonth = `${month}-01`;
  const supabase = await createSupabaseServerClient();

  const [
    budgetPeriod,
    summary,
    categoryProgress,
    unbudgeted,
    expenseCategories,
  ] = await Promise.all([
    getOrCreateBudgetPeriod(supabase, periodMonth),
    getBudgetSummary(supabase, periodMonth),
    getBudgetCategoryProgress(supabase, periodMonth),
    getUnbudgetedExpenses(supabase, periodMonth),
    listCategories(supabase, "expense"),
  ]);

  if (!budgetPeriod) {
    notFound();
  }

  const previousMonth = addMonths(month, -1);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
      <PageHeader
        title="Budget"
        description="Plan spending by category and track it against your real transactions."
        actions={<MonthSelector periodMonth={month} />}
      />

      <p className="rounded-lg border border-border bg-surface p-4 text-sm text-muted-foreground">
        A <span className="font-medium text-foreground">budget</span> plans
        how much you expect to spend per category this month.{" "}
        <Link href="/app/wallets" className="font-medium text-primary underline underline-offset-2">
          Wallets
        </Link>{" "}
        earmark money you already have toward a purpose. A{" "}
        <Link href="/app/goals" className="font-medium text-primary underline underline-offset-2">
          goal
        </Link>{" "}
        tracks progress toward a target over time. All three can reference
        the same categories and money without double-counting it — a budget
        never allocates real money, and allocating a wallet or contributing
        to a goal never changes a budget&apos;s planned or actual figures.
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Card>
          <CardContent className="flex flex-col gap-1 p-4 pt-4">
            <p className="text-sm text-muted-foreground">Planned expenses</p>
            <AmountDisplay value={summary.plannedExpense} size="lg" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-1 p-4 pt-4">
            <p className="text-sm text-muted-foreground">Actual expenses</p>
            <AmountDisplay value={summary.actualExpense} size="lg" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-1 p-4 pt-4">
            <p className="text-sm text-muted-foreground">
              {summary.remaining.isNegative() ? "Overspent" : "Remaining"}
            </p>
            <AmountDisplay
              value={
                summary.remaining.isNegative()
                  ? summary.overspent
                  : summary.remaining
              }
              size="lg"
              {...(summary.remaining.isNegative()
                ? { className: "text-negative" }
                : {})}
            />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-1 p-4 pt-4">
            <p className="text-sm text-muted-foreground">Net cash flow</p>
            <AmountDisplay
              value={summary.actualNetCashFlow}
              size="lg"
              variant="signed"
            />
            <p className="text-xs text-muted-foreground">
              planned income{" "}
              <AmountDisplay value={summary.plannedIncome} size="sm" />
              {" · "}actual{" "}
              <AmountDisplay value={summary.actualIncome} size="sm" />
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <CopyPreviousMonthButton
          sourcePeriodMonth={`${previousMonth}-01`}
          targetPeriodMonth={periodMonth}
        />
      </div>

      <section
        aria-labelledby="progress-heading"
        className="flex flex-col gap-3"
      >
        <SectionHeader id="progress-heading" title="Category progress" />
        {categoryProgress.length === 0 ? (
          <EmptyState
            title="No allocations yet"
            description="Set a planned amount for a category below to start tracking it."
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {categoryProgress.map((progress) => (
              <li key={progress.categoryId}>
                <CategoryProgressRow progress={progress} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {unbudgeted.length > 0 ? (
        <section
          aria-labelledby="unbudgeted-heading"
          className="flex flex-col gap-3"
        >
          <SectionHeader id="unbudgeted-heading" title="Unbudgeted expenses" />
          <p className="text-sm text-muted-foreground">
            Spend in categories with no planned amount this month.
          </p>
          <ul className="flex flex-col gap-2">
            {unbudgeted.map((expense) => (
              <li
                key={expense.categoryId ?? "uncategorized"}
                className="flex items-center justify-between gap-4 rounded-lg border border-border bg-elevated px-4 py-3 text-sm"
              >
                <span className="font-medium text-foreground">
                  {expense.categoryName}
                </span>
                <AmountDisplay value={expense.actualAmount} size="sm" />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="edit-heading" className="flex flex-col gap-3">
        <SectionHeader id="edit-heading" title="Edit allocations" />
        <BudgetAllocationsForm
          budgetPeriodId={budgetPeriod.id}
          expenseCategories={expenseCategories.map((c) => ({
            id: c.id,
            name: c.name,
          }))}
          existingProgress={categoryProgress}
          defaultPlannedIncome={budgetPeriod.plannedIncome?.toString() ?? ""}
        />
      </section>
    </div>
  );
}
