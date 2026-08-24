import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { listAccountsWithBalances } from "@/lib/accounts/queries";
import type { getAuthenticatedUser } from "@/lib/auth/session";
import type {
  getBudgetCategoryProgress,
  getBudgetSummary,
} from "@/lib/budgets/queries";
import type {
  getHoldingSummaries,
  getNetWorthSummaries,
  getPortfolioSummaries,
  getPpfFinancialYearSummary,
  getUpcomingMaturityEvents,
} from "@/lib/investments/queries";
import type {
  getDashboardSummary,
  getExpenseByCategory,
  listRecentTransactionsForUser,
} from "@/lib/ledger/queries";
import type { getMarketDataProviderStates } from "@/lib/market-data/queries";
import { Decimal } from "@/lib/money/decimal";
import type { getProfileForUser } from "@/lib/profile/queries";
import type {
  getSubscriptionCostSummary,
  listOccurrencesWithItems,
  listUpcomingCommitments,
} from "@/lib/recurring/queries";
import type {
  getResearchReviewReminders,
  listAllTheses,
  listInvestmentIdeas,
  listRecentReviewEvents,
  listWatchlists,
} from "@/lib/research/queries";

const getAuthenticatedUserMock = vi.fn<typeof getAuthenticatedUser>();
vi.mock("@/lib/auth/session", () => ({
  getAuthenticatedUser: (...args: Parameters<typeof getAuthenticatedUser>) =>
    getAuthenticatedUserMock(...args),
}));

const getProfileForUserMock = vi.fn<typeof getProfileForUser>();
vi.mock("@/lib/profile/queries", () => ({
  getProfileForUser: (...args: Parameters<typeof getProfileForUser>) =>
    getProfileForUserMock(...args),
}));

const listAccountsWithBalancesMock = vi.fn<typeof listAccountsWithBalances>();
vi.mock("@/lib/accounts/queries", () => ({
  listAccountsWithBalances: (
    ...args: Parameters<typeof listAccountsWithBalances>
  ) => listAccountsWithBalancesMock(...args),
}));

const listRecentTransactionsForUserMock =
  vi.fn<typeof listRecentTransactionsForUser>();
const getDashboardSummaryMock = vi.fn<typeof getDashboardSummary>();
const getExpenseByCategoryMock = vi.fn<typeof getExpenseByCategory>();
vi.mock("@/lib/ledger/queries", () => ({
  listRecentTransactionsForUser: (
    ...args: Parameters<typeof listRecentTransactionsForUser>
  ) => listRecentTransactionsForUserMock(...args),
  getDashboardSummary: (...args: Parameters<typeof getDashboardSummary>) =>
    getDashboardSummaryMock(...args),
  getExpenseByCategory: (...args: Parameters<typeof getExpenseByCategory>) =>
    getExpenseByCategoryMock(...args),
}));

const getBudgetSummaryMock = vi.fn<typeof getBudgetSummary>();
const getBudgetCategoryProgressMock = vi.fn<typeof getBudgetCategoryProgress>();
vi.mock("@/lib/budgets/queries", () => ({
  getBudgetSummary: (...args: Parameters<typeof getBudgetSummary>) =>
    getBudgetSummaryMock(...args),
  getBudgetCategoryProgress: (
    ...args: Parameters<typeof getBudgetCategoryProgress>
  ) => getBudgetCategoryProgressMock(...args),
}));

const getSubscriptionCostSummaryMock =
  vi.fn<typeof getSubscriptionCostSummary>();
const listUpcomingCommitmentsMock = vi.fn<typeof listUpcomingCommitments>();
const listOccurrencesWithItemsMock = vi.fn<typeof listOccurrencesWithItems>();
vi.mock("@/lib/recurring/queries", () => ({
  getSubscriptionCostSummary: (
    ...args: Parameters<typeof getSubscriptionCostSummary>
  ) => getSubscriptionCostSummaryMock(...args),
  listUpcomingCommitments: (
    ...args: Parameters<typeof listUpcomingCommitments>
  ) => listUpcomingCommitmentsMock(...args),
  listOccurrencesWithItems: (
    ...args: Parameters<typeof listOccurrencesWithItems>
  ) => listOccurrencesWithItemsMock(...args),
}));

const getNetWorthSummariesMock = vi.fn<typeof getNetWorthSummaries>();
const getPortfolioSummariesMock = vi.fn<typeof getPortfolioSummaries>();
const getUpcomingMaturityEventsMock = vi.fn<typeof getUpcomingMaturityEvents>();
const getPpfFinancialYearSummaryMock =
  vi.fn<typeof getPpfFinancialYearSummary>();
const getHoldingSummariesMock = vi.fn<typeof getHoldingSummaries>();
vi.mock("@/lib/investments/queries", () => ({
  getNetWorthSummaries: (...args: Parameters<typeof getNetWorthSummaries>) =>
    getNetWorthSummariesMock(...args),
  getPortfolioSummaries: (...args: Parameters<typeof getPortfolioSummaries>) =>
    getPortfolioSummariesMock(...args),
  getUpcomingMaturityEvents: (
    ...args: Parameters<typeof getUpcomingMaturityEvents>
  ) => getUpcomingMaturityEventsMock(...args),
  getPpfFinancialYearSummary: (
    ...args: Parameters<typeof getPpfFinancialYearSummary>
  ) => getPpfFinancialYearSummaryMock(...args),
  getHoldingSummaries: (...args: Parameters<typeof getHoldingSummaries>) =>
    getHoldingSummariesMock(...args),
}));

const getMarketDataProviderStatesMock =
  vi.fn<typeof getMarketDataProviderStates>();
vi.mock("@/lib/market-data/queries", () => ({
  getMarketDataProviderStates: (
    ...args: Parameters<typeof getMarketDataProviderStates>
  ) => getMarketDataProviderStatesMock(...args),
}));

const listWatchlistsMock = vi.fn<typeof listWatchlists>();
const listInvestmentIdeasMock = vi.fn<typeof listInvestmentIdeas>();
const listAllThesesMock = vi.fn<typeof listAllTheses>();
const getResearchReviewRemindersMock =
  vi.fn<typeof getResearchReviewReminders>();
const listRecentReviewEventsMock = vi.fn<typeof listRecentReviewEvents>();
vi.mock("@/lib/research/queries", () => ({
  listWatchlists: (...args: Parameters<typeof listWatchlists>) =>
    listWatchlistsMock(...args),
  listInvestmentIdeas: (...args: Parameters<typeof listInvestmentIdeas>) =>
    listInvestmentIdeasMock(...args),
  listAllTheses: (...args: Parameters<typeof listAllTheses>) =>
    listAllThesesMock(...args),
  getResearchReviewReminders: (
    ...args: Parameters<typeof getResearchReviewReminders>
  ) => getResearchReviewRemindersMock(...args),
  listRecentReviewEvents: (
    ...args: Parameters<typeof listRecentReviewEvents>
  ) => listRecentReviewEventsMock(...args),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(() => Promise.resolve({})),
}));

const redirectMock = vi.fn((url: string): never => {
  throw Object.assign(new Error(`NEXT_REDIRECT:${url}`), {
    digest: `NEXT_REDIRECT;push;${url};307;`,
  });
});
vi.mock("next/navigation", () => ({ redirect: redirectMock }));

beforeEach(() => {
  vi.clearAllMocks();
  getAuthenticatedUserMock.mockResolvedValue({
    id: "user-1",
    email: "asha@example.com",
  });
  getProfileForUserMock.mockResolvedValue(null);
  listAccountsWithBalancesMock.mockResolvedValue([]);
  listRecentTransactionsForUserMock.mockResolvedValue([]);
  getDashboardSummaryMock.mockResolvedValue({
    totalIncome: new Decimal(0),
    totalExpense: new Decimal(0),
    netCashFlow: new Decimal(0),
  });
  getExpenseByCategoryMock.mockResolvedValue([]);
  getBudgetSummaryMock.mockResolvedValue({
    plannedExpense: new Decimal(0),
    actualExpense: new Decimal(0),
    remaining: new Decimal(0),
    overspent: new Decimal(0),
    plannedIncome: new Decimal(0),
    actualIncome: new Decimal(0),
    plannedSurplus: new Decimal(0),
    actualNetCashFlow: new Decimal(0),
    unbudgetedExpenseTotal: new Decimal(0),
  });
  getBudgetCategoryProgressMock.mockResolvedValue([]);
  getSubscriptionCostSummaryMock.mockResolvedValue({
    monthlyEstimate: new Decimal(0),
    annualEstimate: new Decimal(0),
    activeSubscriptionCount: 0,
  });
  listUpcomingCommitmentsMock.mockResolvedValue([]);
  listOccurrencesWithItemsMock.mockResolvedValue([]);
  getNetWorthSummariesMock.mockResolvedValue([]);
  getPortfolioSummariesMock.mockResolvedValue([]);
  getUpcomingMaturityEventsMock.mockResolvedValue([]);
  getPpfFinancialYearSummaryMock.mockResolvedValue([]);
  getHoldingSummariesMock.mockResolvedValue([]);
  getMarketDataProviderStatesMock.mockResolvedValue([]);
  listWatchlistsMock.mockResolvedValue([]);
  listInvestmentIdeasMock.mockResolvedValue([]);
  listAllThesesMock.mockResolvedValue([]);
  getResearchReviewRemindersMock.mockResolvedValue([]);
  listRecentReviewEventsMock.mockResolvedValue([]);
});

describe("AppHomePage", () => {
  it("redirects to /login when there is no authenticated user", async () => {
    getAuthenticatedUserMock.mockResolvedValue(null);
    const { default: AppHomePage } = await import("@/app/app/page");

    await expect(AppHomePage()).rejects.toThrow(/NEXT_REDIRECT/);
    expect(redirectMock).toHaveBeenCalledWith("/login?next=/app");
  });

  it("welcomes the user by their profile display name", async () => {
    getProfileForUserMock.mockResolvedValue({
      id: "user-1",
      display_name: "Asha Rao",
      base_currency: "INR",
      locale: "en-IN",
      timezone: "Asia/Kolkata",
      financial_year_start_month: 4,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    });
    const { default: AppHomePage } = await import("@/app/app/page");

    render(await AppHomePage());

    expect(
      screen.getByRole("heading", { level: 1, name: "Welcome back, Asha Rao" }),
    ).toBeInTheDocument();
  });

  it("falls back to a generic welcome when no display name is set", async () => {
    const { default: AppHomePage } = await import("@/app/app/page");

    render(await AppHomePage());

    expect(
      screen.getByRole("heading", { level: 1, name: "Welcome back" }),
    ).toBeInTheDocument();
  });

  it("shows an onboarding empty state with no accounts", async () => {
    const { default: AppHomePage } = await import("@/app/app/page");

    render(await AppHomePage());

    expect(screen.getByText("Add your first account")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /add an account/i }),
    ).toHaveAttribute("href", "/app/accounts/new");
  });

  it("shows real account balances and a recent-activity feed when accounts exist", async () => {
    listAccountsWithBalancesMock.mockResolvedValue([
      {
        id: "acct-1",
        institutionId: null,
        name: "HDFC Savings",
        accountClass: "asset",
        accountType: "bank_savings",
        currency: "INR",
        lastFour: null,
        creditLimit: null,
        isSystem: false,
        isArchived: false,
        openedOn: null,
        closedOn: null,
        notes: null,
        displayBalance: new Decimal("52340.5"),
      },
    ]);
    listRecentTransactionsForUserMock.mockResolvedValue([
      {
        transaction: {
          id: "txn-1",
          transactionType: "income",
          status: "posted",
          occurredAt: "2026-08-16T10:00:00.000Z",
          description: "Salary",
          notes: null,
          reversalOf: null,
          reversedBy: null,
          categoryId: null,
          payeeId: null,
          replacesTransactionId: null,
        },
        primaryEntry: {
          id: "entry-1",
          transactionId: "txn-1",
          accountId: "acct-1",
          amount: new Decimal("50000"),
          currency: "INR",
          memo: null,
          accountName: "HDFC Savings",
          accountClass: "asset",
        },
      },
    ]);
    const { default: AppHomePage } = await import("@/app/app/page");

    render(await AppHomePage());

    expect(screen.getByText("1 active account")).toBeInTheDocument();
    expect(screen.getByText("₹52,340.50")).toBeInTheDocument();
    expect(screen.getByText("Salary")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "New transaction" }),
    ).toHaveAttribute("href", "/app/transactions/new");
  });

  it("shows the current month's income, expense, net cash flow, and expense breakdown", async () => {
    listAccountsWithBalancesMock.mockResolvedValue([
      {
        id: "acct-1",
        institutionId: null,
        name: "HDFC Savings",
        accountClass: "asset",
        accountType: "bank_savings",
        currency: "INR",
        lastFour: null,
        creditLimit: null,
        isSystem: false,
        isArchived: false,
        openedOn: null,
        closedOn: null,
        notes: null,
        displayBalance: new Decimal("52340.5"),
      },
    ]);
    getDashboardSummaryMock.mockResolvedValue({
      totalIncome: new Decimal("60000"),
      totalExpense: new Decimal("15000"),
      netCashFlow: new Decimal("45000"),
    });
    getExpenseByCategoryMock.mockResolvedValue([
      {
        categoryId: "cat-1",
        categoryName: "Groceries",
        categoryIcon: null,
        categoryColor: null,
        totalAmount: new Decimal("15000"),
      },
    ]);
    const { default: AppHomePage } = await import("@/app/app/page");

    render(await AppHomePage());

    expect(screen.getByText("Income")).toBeInTheDocument();
    expect(screen.getByText("₹60,000.00")).toBeInTheDocument();
    expect(screen.getByText("Expenses")).toBeInTheDocument();
    expect(screen.getByText("Net cash flow")).toBeInTheDocument();
    expect(screen.getByText("₹45,000.00")).toBeInTheDocument();
    expect(screen.getByText("Groceries")).toBeInTheDocument();
    expect(screen.getAllByText("₹15,000.00")).toHaveLength(2);
  });

  it("shows budget progress, subscription cost, upcoming-due total, and a failed-recurring warning", async () => {
    listAccountsWithBalancesMock.mockResolvedValue([
      {
        id: "acct-1",
        institutionId: null,
        name: "HDFC Savings",
        accountClass: "asset",
        accountType: "bank_savings",
        currency: "INR",
        lastFour: null,
        creditLimit: null,
        isSystem: false,
        isArchived: false,
        openedOn: null,
        closedOn: null,
        notes: null,
        displayBalance: new Decimal("52340.5"),
      },
    ]);
    getBudgetSummaryMock.mockResolvedValue({
      plannedExpense: new Decimal("10000"),
      actualExpense: new Decimal("4000"),
      remaining: new Decimal("6000"),
      overspent: new Decimal("0"),
      plannedIncome: new Decimal("0"),
      actualIncome: new Decimal("0"),
      plannedSurplus: new Decimal("0"),
      actualNetCashFlow: new Decimal("0"),
      unbudgetedExpenseTotal: new Decimal("0"),
    });
    getBudgetCategoryProgressMock.mockResolvedValue([
      {
        categoryId: "cat-1",
        categoryName: "Dining out",
        categoryIcon: null,
        categoryColor: null,
        plannedAmount: new Decimal("2000"),
        actualAmount: new Decimal("2200"),
        remainingAmount: new Decimal("-200"),
        usagePercent: new Decimal("110"),
        status: "exceeded",
      },
    ]);
    getSubscriptionCostSummaryMock.mockResolvedValue({
      monthlyEstimate: new Decimal("899"),
      annualEstimate: new Decimal("10788"),
      activeSubscriptionCount: 2,
    });
    listUpcomingCommitmentsMock.mockResolvedValue([
      {
        id: "occ-1",
        recurringItemId: "item-1",
        scheduledDate: "2026-08-22",
        amount: new Decimal("500"),
        currency: "INR",
        status: "due",
        linkedTransactionId: null,
        failureReason: null,
        processedAt: null,
        itemName: "Internet bill",
        itemKind: "bill",
        processingMode: "reminder_only",
      },
    ]);
    listOccurrencesWithItemsMock.mockResolvedValue([
      {
        id: "occ-2",
        recurringItemId: "item-2",
        scheduledDate: "2026-08-15",
        amount: new Decimal("299"),
        currency: "INR",
        status: "failed",
        linkedTransactionId: null,
        failureReason: "insufficient_privilege",
        processedAt: null,
        itemName: "Cloud storage",
        itemKind: "subscription",
        processingMode: "auto_post",
      },
    ]);

    const { default: AppHomePage } = await import("@/app/app/page");

    render(await AppHomePage());

    expect(screen.getByText("Budget spent this month")).toBeInTheDocument();
    expect(screen.getByText("₹4,000.00")).toBeInTheDocument();
    expect(screen.getByText("Dining out")).toBeInTheDocument();
    expect(screen.getByText("Subscriptions / month")).toBeInTheDocument();
    expect(screen.getByText("₹899.00")).toBeInTheDocument();
    expect(screen.getByText("Due in next 7 days")).toBeInTheDocument();
    expect(screen.getByText("₹500.00")).toBeInTheDocument();
    expect(
      screen.getByText(/1 recurring payment failed to post/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View budget" })).toHaveAttribute(
      "href",
      "/app/budgets",
    );
    expect(
      screen.getByRole("link", { name: "View recurring items" }),
    ).toHaveAttribute("href", "/app/recurring");
  });

  it("shows no failed-recurring warning when nothing has failed", async () => {
    listAccountsWithBalancesMock.mockResolvedValue([
      {
        id: "acct-1",
        institutionId: null,
        name: "HDFC Savings",
        accountClass: "asset",
        accountType: "bank_savings",
        currency: "INR",
        lastFour: null,
        creditLimit: null,
        isSystem: false,
        isArchived: false,
        openedOn: null,
        closedOn: null,
        notes: null,
        displayBalance: new Decimal("52340.5"),
      },
    ]);

    const { default: AppHomePage } = await import("@/app/app/page");

    render(await AppHomePage());

    expect(screen.queryByText(/failed to post/i)).not.toBeInTheDocument();
  });

  it("shows a zero-value summary with an empty state when the month has no expenses", async () => {
    listAccountsWithBalancesMock.mockResolvedValue([
      {
        id: "acct-1",
        institutionId: null,
        name: "HDFC Savings",
        accountClass: "asset",
        accountType: "bank_savings",
        currency: "INR",
        lastFour: null,
        creditLimit: null,
        isSystem: false,
        isArchived: false,
        openedOn: null,
        closedOn: null,
        notes: null,
        displayBalance: new Decimal("52340.5"),
      },
    ]);
    const { default: AppHomePage } = await import("@/app/app/page");

    render(await AppHomePage());

    expect(
      screen.getByText("No expenses recorded this month."),
    ).toBeInTheDocument();
  });

  it("never displays the user's full UUID", async () => {
    getAuthenticatedUserMock.mockResolvedValue({
      id: "11111111-1111-1111-1111-111111111111",
      email: "asha@example.com",
    });
    const { default: AppHomePage } = await import("@/app/app/page");

    render(await AppHomePage());

    expect(document.body.textContent).not.toContain(
      "11111111-1111-1111-1111-111111111111",
    );
  });

  it("shows no fabricated balance figures when there are no accounts", async () => {
    const { default: AppHomePage } = await import("@/app/app/page");

    render(await AppHomePage());

    const text = document.body.textContent ?? "";
    expect(text).not.toMatch(/₹\s*[\d,]+/);
  });

  it("shows net worth, total assets, total liabilities, and investment value widgets", async () => {
    listAccountsWithBalancesMock.mockResolvedValue([
      {
        id: "acct-1",
        institutionId: null,
        name: "HDFC Savings",
        accountClass: "asset",
        accountType: "bank_savings",
        currency: "INR",
        lastFour: null,
        creditLimit: null,
        isSystem: false,
        isArchived: false,
        openedOn: null,
        closedOn: null,
        notes: null,
        displayBalance: new Decimal("50000"),
      },
    ]);
    getNetWorthSummariesMock.mockResolvedValue([
      {
        currency: "INR",
        cashAndBank: new Decimal(50000),
        investmentValue: new Decimal(20000),
        ppfBalance: new Decimal(10000),
        fdValue: new Decimal(0),
        rdBalance: new Decimal(0),
        creditCardOutstanding: new Decimal(5000),
        otherLiabilities: new Decimal(0),
        totalAssets: new Decimal(80000),
        totalLiabilities: new Decimal(5000),
        netWorth: new Decimal(75000),
      },
    ]);
    getPortfolioSummariesMock.mockResolvedValue([
      {
        currency: "INR",
        totalInvestedCost: new Decimal(20000),
        totalCurrentValue: new Decimal(22000),
        totalUnrealizedGain: new Decimal(2000),
        totalRealizedGain: new Decimal(0),
        totalIncomeReceived: new Decimal(0),
        activeHoldingsCount: 1,
        missingValuationCount: 0,
      },
    ]);

    const { default: AppHomePage } = await import("@/app/app/page");
    render(await AppHomePage());

    expect(screen.getByText("Net worth")).toBeInTheDocument();
    expect(screen.getByText("Total assets")).toBeInTheDocument();
    expect(screen.getByText("Total liabilities")).toBeInTheDocument();
    expect(screen.getByText("Investments value")).toBeInTheDocument();
    expect(screen.getByText("₹75,000.00")).toBeInTheDocument();
    expect(screen.getByText("₹80,000.00")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "View portfolio" }),
    ).toHaveAttribute("href", "/app/investments");
    expect(
      screen.getByRole("link", { name: "View net worth details" }),
    ).toHaveAttribute("href", "/app/net-worth");
    expect(screen.getByRole("link", { name: "Market data" })).toHaveAttribute(
      "href",
      "/app/settings/market-data",
    );
    expect(screen.getByText("Unrealized gain/loss")).toBeInTheDocument();
    expect(screen.getByText("Realized gain/loss")).toBeInTheDocument();
  });

  it("warns about stale or delayed holding prices and links to market-data settings", async () => {
    listAccountsWithBalancesMock.mockResolvedValue([
      {
        id: "acct-1",
        institutionId: null,
        name: "HDFC Savings",
        accountClass: "asset",
        accountType: "bank_savings",
        currency: "INR",
        lastFour: null,
        creditLimit: null,
        isSystem: false,
        isArchived: false,
        openedOn: null,
        closedOn: null,
        notes: null,
        displayBalance: new Decimal("50000"),
      },
    ]);
    getPortfolioSummariesMock.mockResolvedValue([
      {
        currency: "INR",
        totalInvestedCost: new Decimal(20000),
        totalCurrentValue: new Decimal(22000),
        totalUnrealizedGain: new Decimal(2000),
        totalRealizedGain: new Decimal(0),
        totalIncomeReceived: new Decimal(0),
        activeHoldingsCount: 2,
        missingValuationCount: 0,
      },
    ]);
    getHoldingSummariesMock.mockResolvedValue([
      {
        holdingId: "h1",
        investmentAssetId: "a1",
        assetKind: "mutual_fund",
        displayName: "Test Fund",
        symbol: null,
        currency: "INR",
        status: "active",
        quantity: new Decimal(10),
        avgUnitCost: new Decimal(100),
        costBasis: new Decimal(1000),
        hasValuation: true,
        valuationSource: "amfi",
        priceEffectiveDate: "2026-08-15",
        lastRefreshedAt: "2026-08-15T12:00:00Z",
        priceStatus: "stale",
        currentValue: new Decimal(1100),
        unrealizedGain: new Decimal(100),
        realizedGain: new Decimal(0),
        incomeReceived: new Decimal(0),
      },
    ]);

    const { default: AppHomePage } = await import("@/app/app/page");
    render(await AppHomePage());

    expect(
      screen.getByText(/1 holding has a stale or delayed price/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Review market data" }),
    ).toHaveAttribute("href", "/app/settings/market-data");
  });

  it("shows upcoming maturity events and this financial year's PPF contributions", async () => {
    listAccountsWithBalancesMock.mockResolvedValue([
      {
        id: "acct-1",
        institutionId: null,
        name: "HDFC Savings",
        accountClass: "asset",
        accountType: "bank_savings",
        currency: "INR",
        lastFour: null,
        creditLimit: null,
        isSystem: false,
        isArchived: false,
        openedOn: null,
        closedOn: null,
        notes: null,
        displayBalance: new Decimal("50000"),
      },
    ]);
    getUpcomingMaturityEventsMock.mockResolvedValue([
      {
        holdingId: "holding-1",
        displayName: "HDFC 1-year FD",
        kind: "fixed_deposit",
        maturityDate: "2026-09-15",
        expectedMaturityAmount: new Decimal(107500),
      },
    ]);
    getPpfFinancialYearSummaryMock.mockResolvedValue([
      {
        holdingId: "holding-2",
        displayName: "SBI PPF",
        financialYearStart: "2026-04-01",
        financialYearEnd: "2027-03-31",
        totalContributions: new Decimal(50000),
      },
    ]);

    const { default: AppHomePage } = await import("@/app/app/page");
    render(await AppHomePage());

    expect(
      screen.getByText("HDFC 1-year FD matures 2026-09-15"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/contributed to PPF this financial year/),
    ).toBeInTheDocument();
  });

  it("shows the research summary section without touching ledger/net-worth totals", async () => {
    listAccountsWithBalancesMock.mockResolvedValue([
      {
        id: "acct-1",
        institutionId: null,
        name: "HDFC Savings",
        accountClass: "asset",
        accountType: "bank_savings",
        currency: "INR",
        lastFour: null,
        creditLimit: null,
        isSystem: false,
        isArchived: false,
        openedOn: null,
        closedOn: null,
        notes: null,
        displayBalance: new Decimal("50000"),
      },
    ]);
    listWatchlistsMock.mockResolvedValue([
      {
        id: "wl-1",
        userId: "user-1",
        name: "Compounders",
        description: null,
        color: "slate",
        icon: "star",
        sortOrder: 0,
        status: "active",
        createdAt: "2026-08-01T00:00:00.000Z",
        updatedAt: "2026-08-01T00:00:00.000Z",
      },
    ]);
    listInvestmentIdeasMock.mockResolvedValue([
      {
        id: "idea-1",
        userId: "user-1",
        instrumentId: "instrument-1",
        thesisId: null,
        title: "Margin recovery play",
        status: "researching",
        priority: "medium",
        origin: null,
        rationale: null,
        riskNotes: null,
        nextReviewDate: null,
        createdAt: "2026-08-01T00:00:00.000Z",
        updatedAt: "2026-08-01T00:00:00.000Z",
      },
    ]);
    listAllThesesMock.mockResolvedValue([
      {
        id: "thesis-1",
        userId: "user-1",
        instrumentId: "instrument-1",
        title: "Long-term compounder",
        summary: null,
        investmentCase: null,
        opportunities: null,
        risks: null,
        catalysts: null,
        invalidationConditions: null,
        expectedReviewDate: "2026-07-01",
        timeHorizon: "long_term",
        confidence: "medium",
        status: "needs_review",
        currentVersion: 2,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-08-01T00:00:00.000Z",
      },
    ]);
    getResearchReviewRemindersMock.mockResolvedValue([
      {
        reminderType: "thesis_overdue",
        instrumentId: "instrument-1",
        relatedId: "thesis-1",
        title: "Long-term compounder",
        dueDate: "2026-07-01",
      },
    ]);
    listRecentReviewEventsMock.mockResolvedValue([
      {
        id: "event-1",
        userId: "user-1",
        instrumentId: "instrument-1",
        eventType: "note_created",
        relatedTable: "research_notes",
        relatedId: "note-1",
        summary: "Added a note",
        occurredAt: "2026-08-19T00:00:00.000Z",
      },
    ]);

    const { default: AppHomePage } = await import("@/app/app/page");
    render(await AppHomePage());

    expect(screen.getByText("Research")).toBeInTheDocument();
    expect(screen.getByText("Watchlists")).toBeInTheDocument();
    expect(screen.getByText("Active ideas")).toBeInTheDocument();
    expect(screen.getByText("Theses needing review")).toBeInTheDocument();
    expect(screen.getByText("Overdue reviews")).toBeInTheDocument();
    expect(screen.getByText("Added a note")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Open research" }),
    ).toHaveAttribute("href", "/app/research");
    expect(
      screen.getByRole("link", { name: "View watchlists" }),
    ).toHaveAttribute("href", "/app/watchlists");
    expect(screen.getByRole("link", { name: "View ideas" })).toHaveAttribute(
      "href",
      "/app/research/ideas",
    );

    // The research counters must never be mistaken for ledger amounts — no
    // rupee sign should ever prefix a watchlist/idea/thesis count.
    expect(screen.queryByText("₹1")).not.toBeInTheDocument();
  });

  it("shows no research activity message when there is none", async () => {
    listAccountsWithBalancesMock.mockResolvedValue([
      {
        id: "acct-1",
        institutionId: null,
        name: "HDFC Savings",
        accountClass: "asset",
        accountType: "bank_savings",
        currency: "INR",
        lastFour: null,
        creditLimit: null,
        isSystem: false,
        isArchived: false,
        openedOn: null,
        closedOn: null,
        notes: null,
        displayBalance: new Decimal("50000"),
      },
    ]);

    const { default: AppHomePage } = await import("@/app/app/page");
    render(await AppHomePage());

    expect(screen.getByText("No research activity yet.")).toBeInTheDocument();
  });
});
