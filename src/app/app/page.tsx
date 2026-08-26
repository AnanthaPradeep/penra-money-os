import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, PlusCircle, Wallet } from "lucide-react";

import { AmountDisplay } from "@/components/ui/AmountDisplay";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { listAccountsWithBalances } from "@/lib/accounts/queries";
import { listAiJobs } from "@/lib/ai/queries";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { getBankImportDashboardSummary } from "@/lib/bank-import/queries";
import {
  getBudgetCategoryProgress,
  getBudgetSummary,
} from "@/lib/budgets/queries";
import { formatIstDateTime, nowAsIstCalendarDate } from "@/lib/dates/timezone";
import {
  getDebtCurrentPrincipal,
  getNextUpcomingDebtPayment,
  listDebts,
} from "@/lib/debts/queries";
import { goalFundedAmount } from "@/lib/goals/mapping";
import { listFinancialGoals, listGoalContributions } from "@/lib/goals/queries";
import {
  getHoldingSummaries,
  getNetWorthSummaries,
  getPortfolioSummaries,
  getPpfFinancialYearSummary,
  getUpcomingMaturityEvents,
} from "@/lib/investments/queries";
import { currentIndianFinancialYearStart } from "@/lib/investments/types";
import {
  getDashboardSummary,
  getExpenseByCategory,
  listRecentTransactionsForUser,
} from "@/lib/ledger/queries";
import { getMarketDataProviderStates } from "@/lib/market-data/queries";
import { Decimal } from "@/lib/money/decimal";
import { getForecastCandidateData } from "@/lib/planning/forecast-items";
import { runCashFlowForecast } from "@/lib/planning/forecast";
import { getFinancialPlanningReminders } from "@/lib/planning/reminders";
import { getProfileForUser } from "@/lib/profile/queries";
import {
  getSubscriptionCostSummary,
  listOccurrencesWithItems,
  listUpcomingCommitments,
} from "@/lib/recurring/queries";
import {
  getResearchReviewReminders,
  listAllTheses,
  listInvestmentIdeas,
  listRecentReviewEvents,
  listWatchlists,
} from "@/lib/research/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getSafeToSpendSummary,
  getPurposeWalletSummaries,
} from "@/lib/wallets/queries";

export const metadata: Metadata = {
  title: "Home — PENRA Money OS",
};

/** [first day, last day] of the current month, in "YYYY-MM-DD" form — the default dashboard period. */
function currentMonthRange(): [string, string] {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const start = new Date(Date.UTC(year, month, 1));
  const end = new Date(Date.UTC(year, month + 1, 0));
  const toIsoDate = (date: Date) => date.toISOString().slice(0, 10);
  return [toIsoDate(start), toIsoDate(end)];
}

const MONTH_LABEL_FORMATTER = new Intl.DateTimeFormat("en-IN", {
  month: "long",
  year: "numeric",
  timeZone: "Asia/Kolkata",
});

function addDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * Already gated by src/proxy.ts and src/app/app/layout.tsx for
 * unauthenticated requests, but Server Functions/layouts are not
 * guaranteed to be covered by every Proxy matcher change, so this page
 * independently re-verifies the session rather than assuming that already
 * handled it — defence in depth, per Next.js's own guidance.
 */
export default async function AppHomePage() {
  const user = await getAuthenticatedUser();
  if (!user) {
    redirect("/login?next=/app");
  }

  const [monthStart, monthEnd] = currentMonthRange();
  const today = nowAsIstCalendarDate();
  const within7Days = addDays(today, 7);

  const supabase = await createSupabaseServerClient();
  const [
    profile,
    accounts,
    recentActivity,
    summary,
    expenseByCategory,
    budgetSummary,
    budgetCategoryProgress,
    subscriptionCosts,
    upcomingWithin7Days,
    failedOccurrences,
    netWorthSummaries,
    portfolioSummaries,
    upcomingMaturityEvents,
    ppfFinancialYearSummary,
    holdingSummaries,
    marketDataProviderStates,
    watchlists,
    investmentIdeas,
    theses,
    researchReminders,
    recentResearchEvents,
    aiJobs,
    bankImportSummary,
    safeToSpend,
    walletSummaries,
    activeGoals,
    activeDebts,
    nextDebtPayment,
    planningReminders,
    forecastCandidateData,
  ] = await Promise.all([
    getProfileForUser(user.id),
    listAccountsWithBalances(supabase),
    listRecentTransactionsForUser(supabase, 6),
    getDashboardSummary(supabase, monthStart, monthEnd),
    getExpenseByCategory(supabase, monthStart, monthEnd),
    getBudgetSummary(supabase, monthStart),
    getBudgetCategoryProgress(supabase, monthStart),
    getSubscriptionCostSummary(supabase),
    listUpcomingCommitments(supabase, within7Days),
    listOccurrencesWithItems(supabase, "failed"),
    getNetWorthSummaries(supabase),
    getPortfolioSummaries(supabase),
    getUpcomingMaturityEvents(supabase, 30),
    getPpfFinancialYearSummary(supabase, currentIndianFinancialYearStart()),
    getHoldingSummaries(supabase),
    getMarketDataProviderStates(supabase),
    listWatchlists(supabase),
    listInvestmentIdeas(supabase),
    listAllTheses(supabase),
    getResearchReviewReminders(supabase),
    listRecentReviewEvents(supabase, 4),
    listAiJobs(supabase),
    getBankImportDashboardSummary(supabase),
    getSafeToSpendSummary(supabase),
    getPurposeWalletSummaries(supabase),
    listFinancialGoals(supabase),
    listDebts(supabase, { includeClosed: false }),
    getNextUpcomingDebtPayment(supabase),
    getFinancialPlanningReminders(supabase),
    getForecastCandidateData(supabase, today),
  ]);

  const forecast30d = runCashFlowForecast({
    scenario: "baseline",
    horizon: "30d",
    asOf: today,
    openingBalance: forecastCandidateData.openingBalance,
    items: forecastCandidateData.items,
    dataCompleteness: forecastCandidateData.dataCompleteness,
  });

  const activeWallets = walletSummaries.filter((w) => w.status === "active");
  const totalWalletAllocated = activeWallets.reduce(
    (sum, w) => sum.plus(w.allocatedBalance),
    new Decimal(0),
  );
  const emergencyFundGoal = activeGoals.find(
    (g) => g.goalType === "emergency_fund" && g.status === "active",
  );
  const emergencyFundContributions = emergencyFundGoal
    ? await listGoalContributions(supabase, emergencyFundGoal.id)
    : [];
  const emergencyFundFunded = emergencyFundGoal
    ? goalFundedAmount(emergencyFundContributions)
    : null;
  const priorityGoals = [...activeGoals]
    .filter((g) => g.status === "active")
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 3);
  const debtPrincipals = await Promise.all(
    activeDebts
      .filter((d) => d.status === "active")
      .map((d) => getDebtCurrentPrincipal(supabase, d.id)),
  );
  const totalDebtOutstanding = debtPrincipals.reduce(
    (sum, p) => sum.plus(p),
    new Decimal(0),
  );

  const displayName = profile?.display_name;
  const hasAccounts = accounts.length > 0;
  const nearLimitCategories = budgetCategoryProgress.filter(
    (p) => p.status === "warning" || p.status === "exceeded",
  );
  const totalDueWithin7Days = upcomingWithin7Days.reduce(
    (sum, o) => sum.plus(o.amount),
    new Decimal(0),
  );
  const totalCreditCardOutstanding = accounts
    .filter((a) => a.accountType === "credit_card")
    .reduce((sum, a) => sum.plus(a.displayBalance), new Decimal(0));

  const primaryNetWorth =
    netWorthSummaries.find((s) => s.currency === "INR") ?? null;
  const primaryPortfolio =
    portfolioSummaries.find((s) => s.currency === "INR") ?? null;
  const totalPpfContributionsThisYear = ppfFinancialYearSummary.reduce(
    (sum, s) => sum.plus(s.totalContributions),
    new Decimal(0),
  );

  const activeHoldingsInr = holdingSummaries.filter(
    (h) => h.status === "active" && h.currency === "INR",
  );
  const staleOrDelayedHoldingsCount = activeHoldingsInr.filter(
    (h) => h.priceStatus === "stale" || h.priceStatus === "delayed",
  ).length;
  const lastMarketDataUpdate = marketDataProviderStates
    .map((s) => s.lastSuccessAt)
    .filter((v): v is string => v !== null)
    .sort()
    .at(-1);

  // Research summary counts — deliberately never combined with any of the
  // ledger/investment totals above; research records can never mutate a
  // balance, holding, or transaction, so they get their own section.
  const activeWatchlistsCount = watchlists.filter(
    (w) => w.status === "active",
  ).length;
  const activeIdeasCount = investmentIdeas.filter(
    (i) => i.status !== "closed" && i.status !== "archived",
  ).length;
  const thesesNeedingReviewCount = theses.filter(
    (t) => t.status === "needs_review",
  ).length;
  const overdueThesisReviewsCount = researchReminders.filter(
    (r) => r.reminderType === "thesis_overdue",
  ).length;
  const fundamentalsProviderState = marketDataProviderStates.find(
    (s) => s.provider === "twelve_data",
  );
  const fundamentalsProviderFailing =
    fundamentalsProviderState !== undefined &&
    fundamentalsProviderState.isConfigured &&
    fundamentalsProviderState.consecutiveFailures > 0;

  // Phase 10 counts — IPOs/events/AI stay in their own section below,
  // never mixed into net-worth/income/expense/returns/allocation/budget,
  // exactly like the Research section above. researchReminders already
  // includes the Phase 10 IPO/event/thesis-review branches (see
  // research_review_reminders' Phase 10 follow-up migration), so these
  // are free filters over data already fetched, not new queries.
  const iposOpeningOrClosingSoonCount = researchReminders.filter(
    (r) =>
      r.reminderType === "ipo_opening_soon" ||
      r.reminderType === "ipo_closing_soon",
  ).length;
  const ipoWatchlistReviewDueCount = researchReminders.filter(
    (r) => r.reminderType === "ipo_watchlist_review_due",
  ).length;
  const upcomingEventReminders = researchReminders.filter((r) =>
    r.reminderType.startsWith("event_"),
  );
  const resultsDueSoonCount = researchReminders.filter(
    (r) => r.reminderType === "event_results_due_soon",
  ).length;
  const thesisReviewTriggeredByEventCount = researchReminders.filter(
    (r) => r.reminderType === "thesis_review_triggered_by_event",
  ).length;
  const pendingAiReviewCount = aiJobs.filter(
    (j) => j.status === "completed" && j.humanReviewStatus === null,
  ).length;
  const failedAiJobsCount = aiJobs.filter(
    (j) => j.status === "failed" || j.status === "blocked",
  ).length;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={displayName ? `Welcome back, ${displayName}` : "Welcome back"}
        description="Here's where things stand."
        actions={
          hasAccounts ? (
            <Button asChild>
              <Link href="/app/transactions/new">
                <PlusCircle aria-hidden="true" className="size-4" />
                New transaction
              </Link>
            </Button>
          ) : null
        }
      />

      {!hasAccounts ? (
        <EmptyState
          icon={<Wallet aria-hidden="true" className="size-6" />}
          title="Add your first account"
          description="Bank, cash, wallet, credit card, or loan — once an account exists you can start recording transactions against it."
          action={
            <Button asChild>
              <Link href="/app/accounts/new">
                <PlusCircle aria-hidden="true" className="size-4" />
                Add an account
              </Link>
            </Button>
          }
        />
      ) : (
        <>
          <section
            aria-labelledby="dashboard-summary-heading"
            className="flex flex-col gap-3"
          >
            <SectionHeader
              id="dashboard-summary-heading"
              title={MONTH_LABEL_FORMATTER.format(new Date())}
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardContent className="flex flex-col gap-1 p-4 pt-4">
                  <p className="text-sm text-muted-foreground">Income</p>
                  <AmountDisplay value={summary.totalIncome} size="lg" />
                </CardContent>
              </Card>
              <Card>
                <CardContent className="flex flex-col gap-1 p-4 pt-4">
                  <p className="text-sm text-muted-foreground">Expenses</p>
                  <AmountDisplay value={summary.totalExpense} size="lg" />
                </CardContent>
              </Card>
              <Card>
                <CardContent className="flex flex-col gap-1 p-4 pt-4">
                  <p className="text-sm text-muted-foreground">Net cash flow</p>
                  <AmountDisplay
                    value={summary.netCashFlow}
                    size="lg"
                    variant="signed"
                  />
                </CardContent>
              </Card>
              {totalCreditCardOutstanding.greaterThan(0) ? (
                <Card>
                  <CardContent className="flex flex-col gap-1 p-4 pt-4">
                    <p className="text-sm text-muted-foreground">
                      Credit card outstanding
                    </p>
                    <AmountDisplay
                      value={totalCreditCardOutstanding}
                      size="lg"
                    />
                  </CardContent>
                </Card>
              ) : null}
            </div>
            {expenseByCategory.length > 0 ? (
              <ul className="flex flex-col gap-2">
                {expenseByCategory.map((row) => (
                  <li
                    key={row.categoryId ?? "uncategorized"}
                    className="flex items-center justify-between gap-4 rounded-lg border border-border bg-elevated px-4 py-3 text-sm"
                  >
                    <span className="font-medium text-foreground">
                      {row.categoryName}
                    </span>
                    <AmountDisplay value={row.totalAmount} size="sm" />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                No expenses recorded this month.
              </p>
            )}
          </section>

          <section
            aria-labelledby="budgets-recurring-heading"
            className="flex flex-col gap-3"
          >
            <SectionHeader
              id="budgets-recurring-heading"
              title="Budgets & recurring"
            />

            {failedOccurrences.length > 0 ? (
              <Link
                href="/app/recurring"
                className="flex items-center gap-3 rounded-lg border border-negative/30 bg-negative-surface px-4 py-3 text-sm text-negative transition-colors hover:border-negative/50"
              >
                <AlertTriangle aria-hidden="true" className="size-4 shrink-0" />
                {failedOccurrences.length} recurring{" "}
                {failedOccurrences.length === 1 ? "payment" : "payments"} failed
                to post — review and retry.
              </Link>
            ) : null}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Card>
                <CardContent className="flex flex-col gap-1 p-4 pt-4">
                  <p className="text-sm text-muted-foreground">
                    Budget spent this month
                  </p>
                  <AmountDisplay
                    value={budgetSummary.actualExpense}
                    size="lg"
                  />
                  <p className="text-xs text-muted-foreground">
                    of{" "}
                    <AmountDisplay
                      value={budgetSummary.plannedExpense}
                      size="sm"
                    />{" "}
                    planned
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="flex flex-col gap-1 p-4 pt-4">
                  <p className="text-sm text-muted-foreground">
                    Due in next 7 days
                  </p>
                  <AmountDisplay value={totalDueWithin7Days} size="lg" />
                  <p className="text-xs text-muted-foreground">
                    upcoming — not yet counted as spent
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="flex flex-col gap-1 p-4 pt-4">
                  <p className="text-sm text-muted-foreground">
                    Subscriptions / month
                  </p>
                  <AmountDisplay
                    value={subscriptionCosts.monthlyEstimate}
                    size="lg"
                  />
                  <p className="text-xs text-muted-foreground">estimate</p>
                </CardContent>
              </Card>
            </div>

            {nearLimitCategories.length > 0 ? (
              <ul className="flex flex-col gap-2">
                {nearLimitCategories.map((progress) => (
                  <li
                    key={progress.categoryId}
                    className="flex items-center justify-between gap-4 rounded-lg border border-border bg-elevated px-4 py-3 text-sm"
                  >
                    <span className="font-medium text-foreground">
                      {progress.categoryName}
                    </span>
                    <span
                      className={
                        progress.status === "exceeded"
                          ? "font-medium text-negative"
                          : "font-medium text-warning"
                      }
                    >
                      <AmountDisplay value={progress.actualAmount} size="sm" />{" "}
                      of{" "}
                      <AmountDisplay value={progress.plannedAmount} size="sm" />
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}

            <div className="flex gap-4 text-sm">
              <Link
                href="/app/budgets"
                className="font-medium text-primary hover:underline"
              >
                View budget
              </Link>
              <Link
                href="/app/recurring"
                className="font-medium text-primary hover:underline"
              >
                View recurring items
              </Link>
            </div>
          </section>

          <section
            aria-labelledby="planning-heading"
            className="flex flex-col gap-3"
          >
            <SectionHeader
              id="planning-heading"
              title="Wallets, goals & debts"
              actions={
                <Link
                  href="/app/wallets"
                  className="text-sm font-medium text-primary hover:underline"
                >
                  Open wallets
                </Link>
              }
            />

            {forecast30d.shortfallDate ? (
              <div className="flex items-center gap-3 rounded-lg border border-negative/30 bg-negative-surface px-4 py-3 text-sm text-negative">
                <AlertTriangle aria-hidden="true" className="size-4 shrink-0" />
                Projected shortfall around {forecast30d.shortfallDate} in the
                next 30 days.{" "}
                <Link href="/app/forecast" className="underline">
                  View forecast
                </Link>
              </div>
            ) : null}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardContent className="flex flex-col gap-1 p-4 pt-4">
                  <p className="text-sm text-muted-foreground">Safe to spend</p>
                  <AmountDisplay
                    value={safeToSpend?.safeToSpend ?? new Decimal(0)}
                    size="lg"
                  />
                  <p className="text-xs text-muted-foreground">estimate</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="flex flex-col gap-1 p-4 pt-4">
                  <p className="text-sm text-muted-foreground">
                    Allocated to wallets
                  </p>
                  <AmountDisplay value={totalWalletAllocated} size="lg" />
                  <p className="text-xs text-muted-foreground">
                    across {activeWallets.length} active{" "}
                    {activeWallets.length === 1 ? "wallet" : "wallets"}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="flex flex-col gap-1 p-4 pt-4">
                  <p className="text-sm text-muted-foreground">Total debt</p>
                  <AmountDisplay value={totalDebtOutstanding} size="lg" />
                  <p className="text-xs text-muted-foreground">
                    outstanding principal
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="flex flex-col gap-1 p-4 pt-4">
                  <p className="text-sm text-muted-foreground">
                    30-day forecast
                  </p>
                  <AmountDisplay value={forecast30d.closingBalance} size="lg" />
                  <p className="text-xs text-muted-foreground">
                    projected closing balance ({forecast30d.status})
                  </p>
                </CardContent>
              </Card>
            </div>

            {emergencyFundGoal && emergencyFundFunded ? (
              <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-elevated px-4 py-3 text-sm">
                <span className="font-medium text-foreground">
                  Emergency fund: {emergencyFundGoal.name}
                </span>
                <span className="text-muted-foreground">
                  <AmountDisplay value={emergencyFundFunded} size="sm" /> of{" "}
                  <AmountDisplay
                    value={emergencyFundGoal.targetAmount}
                    size="sm"
                  />
                </span>
              </div>
            ) : null}

            {priorityGoals.length > 0 ? (
              <ul className="flex flex-col gap-2">
                {priorityGoals.map((goal) => (
                  <li key={goal.id}>
                    <Link
                      href={`/app/goals/${goal.id}`}
                      className="flex items-center justify-between gap-4 rounded-lg border border-border bg-elevated px-4 py-3 text-sm transition-colors hover:border-input-border"
                    >
                      <span className="font-medium text-foreground">
                        {goal.name}
                      </span>
                      <AmountDisplay value={goal.targetAmount} size="sm" />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}

            {nextDebtPayment ? (
              <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-elevated px-4 py-3 text-sm">
                <span className="font-medium text-foreground">
                  Next payment: {nextDebtPayment.debtName}
                </span>
                <span className="text-muted-foreground">
                  <AmountDisplay
                    value={nextDebtPayment.scheduledPayment}
                    size="sm"
                  />{" "}
                  due {nextDebtPayment.dueDate}
                </span>
              </div>
            ) : null}

            {planningReminders.some(
              (r) => r.reminderType === "purpose_wallet_overspent",
            ) ? (
              <div className="flex items-center gap-3 rounded-lg border border-warning/30 bg-warning-surface px-4 py-3 text-sm text-warning">
                <AlertTriangle aria-hidden="true" className="size-4 shrink-0" />
                One or more wallets are overspent.{" "}
                <Link href="/app/wallets" className="underline">
                  Review wallets
                </Link>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-4 text-sm">
              <Link
                href="/app/goals"
                className="font-medium text-primary hover:underline"
              >
                View goals
              </Link>
              <Link
                href="/app/debts"
                className="font-medium text-primary hover:underline"
              >
                View debts
              </Link>
              <Link
                href="/app/debts/strategy"
                className="font-medium text-primary hover:underline"
              >
                Compare payoff strategies
              </Link>
              <Link
                href="/app/forecast"
                className="font-medium text-primary hover:underline"
              >
                Full forecast
              </Link>
            </div>
          </section>

          <section
            aria-labelledby="net-worth-heading"
            className="flex flex-col gap-3"
          >
            <SectionHeader
              id="net-worth-heading"
              title="Net worth & investments"
            />

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardContent className="flex flex-col gap-1 p-4 pt-4">
                  <p className="text-sm text-muted-foreground">Net worth</p>
                  <AmountDisplay
                    value={primaryNetWorth?.netWorth ?? new Decimal(0)}
                    size="lg"
                  />
                </CardContent>
              </Card>
              <Card>
                <CardContent className="flex flex-col gap-1 p-4 pt-4">
                  <p className="text-sm text-muted-foreground">Total assets</p>
                  <AmountDisplay
                    value={primaryNetWorth?.totalAssets ?? new Decimal(0)}
                    size="lg"
                  />
                </CardContent>
              </Card>
              <Card>
                <CardContent className="flex flex-col gap-1 p-4 pt-4">
                  <p className="text-sm text-muted-foreground">
                    Total liabilities
                  </p>
                  <AmountDisplay
                    value={primaryNetWorth?.totalLiabilities ?? new Decimal(0)}
                    size="lg"
                  />
                </CardContent>
              </Card>
              <Card>
                <CardContent className="flex flex-col gap-1 p-4 pt-4">
                  <p className="text-sm text-muted-foreground">
                    Investments value
                  </p>
                  <AmountDisplay
                    value={
                      primaryPortfolio?.totalCurrentValue ?? new Decimal(0)
                    }
                    size="lg"
                  />
                  <p className="text-xs text-muted-foreground">
                    provider prices, manual valuations, or cost basis
                  </p>
                </CardContent>
              </Card>
            </div>

            {primaryPortfolio && primaryPortfolio.activeHoldingsCount > 0 ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Card>
                  <CardContent className="flex flex-col gap-1 p-4 pt-4">
                    <p className="text-sm text-muted-foreground">
                      Unrealized gain/loss
                    </p>
                    <AmountDisplay
                      value={primaryPortfolio.totalUnrealizedGain}
                      size="md"
                      variant="signed"
                    />
                    <p className="text-xs text-muted-foreground">
                      from holdings with a valuation (provider or manual)
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="flex flex-col gap-1 p-4 pt-4">
                    <p className="text-sm text-muted-foreground">
                      Realized gain/loss
                    </p>
                    <AmountDisplay
                      value={primaryPortfolio.totalRealizedGain}
                      size="md"
                      variant="signed"
                    />
                    <p className="text-xs text-muted-foreground">
                      from sales and maturities to date
                    </p>
                  </CardContent>
                </Card>
              </div>
            ) : null}

            {primaryPortfolio && primaryPortfolio.missingValuationCount > 0 ? (
              <div className="flex items-center gap-3 rounded-lg border border-warning/30 bg-warning-surface px-4 py-3 text-sm text-warning">
                <AlertTriangle aria-hidden="true" className="size-4 shrink-0" />
                {primaryPortfolio.missingValuationCount}{" "}
                {primaryPortfolio.missingValuationCount === 1
                  ? "holding has"
                  : "holdings have"}{" "}
                no valuation yet — shown at cost basis.
              </div>
            ) : null}
            {staleOrDelayedHoldingsCount > 0 ? (
              <div className="flex items-center gap-3 rounded-lg border border-warning/30 bg-warning-surface px-4 py-3 text-sm text-warning">
                <AlertTriangle aria-hidden="true" className="size-4 shrink-0" />
                {staleOrDelayedHoldingsCount}{" "}
                {staleOrDelayedHoldingsCount === 1
                  ? "holding has a"
                  : "holdings have"}{" "}
                stale or delayed price.{" "}
                <Link href="/app/settings/market-data" className="underline">
                  Review market data
                </Link>
              </div>
            ) : null}
            {lastMarketDataUpdate ? (
              <p className="text-xs text-muted-foreground">
                Market data last updated{" "}
                {formatIstDateTime(lastMarketDataUpdate)}
              </p>
            ) : null}

            {upcomingMaturityEvents.length > 0 ? (
              <ul className="flex flex-col gap-2">
                {upcomingMaturityEvents.map((event) => (
                  <li
                    key={event.holdingId}
                    className="flex items-center justify-between gap-4 rounded-lg border border-border bg-elevated px-4 py-3 text-sm"
                  >
                    <span className="font-medium text-foreground">
                      {event.displayName} matures {event.maturityDate}
                    </span>
                    {event.expectedMaturityAmount ? (
                      <AmountDisplay
                        value={event.expectedMaturityAmount}
                        size="sm"
                      />
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}

            {totalPpfContributionsThisYear.greaterThan(0) ? (
              <p className="text-sm text-muted-foreground">
                <AmountDisplay
                  value={totalPpfContributionsThisYear}
                  size="sm"
                />{" "}
                contributed to PPF this financial year
              </p>
            ) : null}

            <div className="flex gap-4 text-sm">
              <Link
                href="/app/investments"
                className="font-medium text-primary hover:underline"
              >
                View portfolio
              </Link>
              <Link
                href="/app/net-worth"
                className="font-medium text-primary hover:underline"
              >
                View net worth details
              </Link>
              <Link
                href="/app/settings/market-data"
                className="font-medium text-primary hover:underline"
              >
                Market data
              </Link>
            </div>
          </section>

          <section
            aria-labelledby="research-heading"
            className="flex flex-col gap-3"
          >
            <SectionHeader
              id="research-heading"
              title="Research"
              actions={
                <Link
                  href="/app/research"
                  className="text-sm font-medium text-primary hover:underline"
                >
                  Open research
                </Link>
              }
            />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Card>
                <CardContent className="flex flex-col gap-1 p-4 pt-4">
                  <p className="text-sm text-muted-foreground">Watchlists</p>
                  <p className="text-xl font-semibold text-foreground">
                    {activeWatchlistsCount}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="flex flex-col gap-1 p-4 pt-4">
                  <p className="text-sm text-muted-foreground">Active ideas</p>
                  <p className="text-xl font-semibold text-foreground">
                    {activeIdeasCount}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="flex flex-col gap-1 p-4 pt-4">
                  <p className="text-sm text-muted-foreground">
                    Theses needing review
                  </p>
                  <p className="text-xl font-semibold text-foreground">
                    {thesesNeedingReviewCount}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="flex flex-col gap-1 p-4 pt-4">
                  <p className="text-sm text-muted-foreground">
                    Overdue reviews
                  </p>
                  <p className="text-xl font-semibold text-foreground">
                    {overdueThesisReviewsCount}
                  </p>
                </CardContent>
              </Card>
            </div>
            {fundamentalsProviderFailing ? (
              <div className="flex items-center gap-3 rounded-lg border border-warning/30 bg-warning-surface px-4 py-3 text-sm text-warning">
                <AlertTriangle aria-hidden="true" className="size-4 shrink-0" />
                Fundamentals refresh has failed{" "}
                {fundamentalsProviderState?.consecutiveFailures} time
                {fundamentalsProviderState?.consecutiveFailures === 1
                  ? ""
                  : "s"}{" "}
                in a row.
              </div>
            ) : null}
            {recentResearchEvents.length > 0 ? (
              <ul className="flex flex-col gap-2">
                {recentResearchEvents.map((event) => (
                  <li
                    key={event.id}
                    className="flex items-center justify-between gap-4 rounded-lg border border-border bg-elevated px-4 py-3 text-sm"
                  >
                    <span className="truncate text-foreground">
                      {event.summary ?? event.eventType}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatIstDateTime(event.occurredAt)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                No research activity yet.
              </p>
            )}
            <div className="flex gap-4 text-sm">
              <Link
                href="/app/watchlists"
                className="font-medium text-primary hover:underline"
              >
                View watchlists
              </Link>
              <Link
                href="/app/research/ideas"
                className="font-medium text-primary hover:underline"
              >
                View ideas
              </Link>
            </div>
          </section>

          <section
            aria-labelledby="ipos-events-ai-heading"
            className="flex flex-col gap-3"
          >
            <SectionHeader
              id="ipos-events-ai-heading"
              title="IPOs, events & AI"
              actions={
                <Link
                  href="/app/ipos"
                  className="text-sm font-medium text-primary hover:underline"
                >
                  Open IPOs
                </Link>
              }
            />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Card>
                <CardContent className="flex flex-col gap-1 p-4 pt-4">
                  <p className="text-sm text-muted-foreground">
                    IPOs opening/closing soon
                  </p>
                  <p className="text-xl font-semibold text-foreground">
                    {iposOpeningOrClosingSoonCount}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="flex flex-col gap-1 p-4 pt-4">
                  <p className="text-sm text-muted-foreground">
                    Watched IPOs to review
                  </p>
                  <p className="text-xl font-semibold text-foreground">
                    {ipoWatchlistReviewDueCount}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="flex flex-col gap-1 p-4 pt-4">
                  <p className="text-sm text-muted-foreground">
                    Upcoming events on holdings
                  </p>
                  <p className="text-xl font-semibold text-foreground">
                    {upcomingEventReminders.length}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="flex flex-col gap-1 p-4 pt-4">
                  <p className="text-sm text-muted-foreground">
                    Results due soon
                  </p>
                  <p className="text-xl font-semibold text-foreground">
                    {resultsDueSoonCount}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="flex flex-col gap-1 p-4 pt-4">
                  <p className="text-sm text-muted-foreground">
                    Theses to review after an event
                  </p>
                  <p className="text-xl font-semibold text-foreground">
                    {thesisReviewTriggeredByEventCount}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="flex flex-col gap-1 p-4 pt-4">
                  <p className="text-sm text-muted-foreground">
                    AI outputs pending your review
                  </p>
                  <p className="text-xl font-semibold text-foreground">
                    {pendingAiReviewCount}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="flex flex-col gap-1 p-4 pt-4">
                  <p className="text-sm text-muted-foreground">
                    Failed/blocked AI requests
                  </p>
                  <p className="text-xl font-semibold text-foreground">
                    {failedAiJobsCount}
                  </p>
                </CardContent>
              </Card>
            </div>
            <div className="flex flex-wrap gap-4 text-sm">
              <Link
                href="/app/events"
                className="font-medium text-primary hover:underline"
              >
                View events
              </Link>
              <Link
                href="/app/research/assistant"
                className="font-medium text-primary hover:underline"
              >
                Ask the research assistant
              </Link>
              <Link
                href="/app/research/ai-jobs"
                className="font-medium text-primary hover:underline"
              >
                View AI requests
              </Link>
            </div>
          </section>

          <section
            aria-labelledby="accounts-summary-heading"
            className="flex flex-col gap-3"
          >
            <SectionHeader
              id="accounts-summary-heading"
              title={`${accounts.length} active ${accounts.length === 1 ? "account" : "accounts"}`}
              actions={
                <Link
                  href="/app/accounts"
                  className="text-sm font-medium text-primary hover:underline"
                >
                  View all
                </Link>
              }
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {accounts.slice(0, 6).map((account) => (
                <Card key={account.id}>
                  <CardContent className="flex flex-col gap-1 p-4 pt-4">
                    <p className="truncate text-sm text-muted-foreground">
                      {account.name}
                    </p>
                    <AmountDisplay value={account.displayBalance} size="lg" />
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          <section
            aria-labelledby="import-heading"
            className="flex flex-col gap-3"
          >
            <SectionHeader
              id="import-heading"
              title="Bank statement import"
              actions={
                <Link
                  href="/app/import"
                  className="text-sm font-medium text-primary hover:underline"
                >
                  Open imports
                </Link>
              }
            />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Card>
                <CardContent className="flex flex-col gap-1 p-4 pt-4">
                  <p className="text-sm text-muted-foreground">
                    Awaiting review
                  </p>
                  <p className="text-xl font-semibold text-foreground">
                    {bankImportSummary.awaitingReviewCount}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="flex flex-col gap-1 p-4 pt-4">
                  <p className="text-sm text-muted-foreground">
                    Failed imports
                  </p>
                  <p className="text-xl font-semibold text-foreground">
                    {bankImportSummary.failedCount}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="flex flex-col gap-1 p-4 pt-4">
                  <p className="text-sm text-muted-foreground">
                    Unreconciled statements
                  </p>
                  <p className="text-xl font-semibold text-foreground">
                    {bankImportSummary.unreconciledCount}
                  </p>
                </CardContent>
              </Card>
            </div>
            {bankImportSummary.failedCount > 0 ? (
              <Link
                href="/app/import"
                className="flex items-center gap-3 rounded-lg border border-negative/30 bg-negative-surface px-4 py-3 text-sm text-negative transition-colors hover:border-negative/50"
              >
                <AlertTriangle aria-hidden="true" className="size-4 shrink-0" />
                {bankImportSummary.failedCount} import
                {bankImportSummary.failedCount === 1 ? "" : "s"} failed to post
                — review and retry.
              </Link>
            ) : null}
            {bankImportSummary.lastCompletedImport ? (
              <p className="text-xs text-muted-foreground">
                Last completed import:{" "}
                {bankImportSummary.lastCompletedImport.originalFilename}
                {bankImportSummary.lastCompletedImport.completedAt
                  ? ` (${formatIstDateTime(bankImportSummary.lastCompletedImport.completedAt)})`
                  : ""}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                No statements imported yet.
              </p>
            )}
          </section>

          <section
            aria-labelledby="recent-activity-heading"
            className="flex flex-col gap-3"
          >
            <SectionHeader
              id="recent-activity-heading"
              title="Recent activity"
            />
            {recentActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No transactions recorded yet.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {recentActivity.map(({ transaction, primaryEntry }) => (
                  <li key={transaction.id}>
                    <Link
                      href={`/app/transactions/${transaction.id}`}
                      className="flex items-center justify-between gap-4 rounded-lg border border-border bg-elevated px-4 py-3 text-sm transition-colors hover:border-input-border"
                    >
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <span className="truncate font-medium text-foreground">
                          {transaction.description}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">
                          {primaryEntry.accountName} &middot;{" "}
                          {formatIstDateTime(transaction.occurredAt)}
                        </span>
                      </span>
                      <AmountDisplay
                        value={primaryEntry.amount}
                        variant="signed"
                        size="sm"
                        className="shrink-0"
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
