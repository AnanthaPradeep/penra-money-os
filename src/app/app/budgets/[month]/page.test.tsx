import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { getAuthenticatedUser } from "@/lib/auth/session";
import type {
  getBudgetCategoryProgress,
  getBudgetSummary,
  getOrCreateBudgetPeriod,
  getUnbudgetedExpenses,
} from "@/lib/budgets/queries";
import type { BudgetPeriod, BudgetSummary } from "@/lib/budgets/mapping";
import type { listCategories } from "@/lib/categories/queries";
import { Decimal } from "@/lib/money/decimal";

const getAuthenticatedUserMock = vi.fn<typeof getAuthenticatedUser>();
vi.mock("@/lib/auth/session", () => ({
  getAuthenticatedUser: (...args: Parameters<typeof getAuthenticatedUser>) =>
    getAuthenticatedUserMock(...args),
}));

const getOrCreateBudgetPeriodMock = vi.fn<typeof getOrCreateBudgetPeriod>();
const getBudgetSummaryMock = vi.fn<typeof getBudgetSummary>();
const getBudgetCategoryProgressMock = vi.fn<typeof getBudgetCategoryProgress>();
const getUnbudgetedExpensesMock = vi.fn<typeof getUnbudgetedExpenses>();
vi.mock("@/lib/budgets/queries", () => ({
  getOrCreateBudgetPeriod: (
    ...args: Parameters<typeof getOrCreateBudgetPeriod>
  ) => getOrCreateBudgetPeriodMock(...args),
  getBudgetSummary: (...args: Parameters<typeof getBudgetSummary>) =>
    getBudgetSummaryMock(...args),
  getBudgetCategoryProgress: (
    ...args: Parameters<typeof getBudgetCategoryProgress>
  ) => getBudgetCategoryProgressMock(...args),
  getUnbudgetedExpenses: (...args: Parameters<typeof getUnbudgetedExpenses>) =>
    getUnbudgetedExpensesMock(...args),
}));

const listCategoriesMock = vi.fn<typeof listCategories>();
vi.mock("@/lib/categories/queries", () => ({
  listCategories: (...args: Parameters<typeof listCategories>) =>
    listCategoriesMock(...args),
}));

vi.mock("@/lib/budgets/actions", () => ({
  saveBudgetAllocationsAction: vi.fn(),
  copyBudgetPeriodAction: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(() => Promise.resolve({})),
}));

const routerRefreshMock = vi.fn();
const redirectMock = vi.fn((url: string): never => {
  throw Object.assign(new Error(`NEXT_REDIRECT:${url}`), {
    digest: `NEXT_REDIRECT;push;${url};307;`,
  });
});
const notFoundMock = vi.fn((): never => {
  throw Object.assign(new Error("NEXT_NOT_FOUND"), {
    digest: "NEXT_NOT_FOUND",
  });
});
vi.mock("next/navigation", () => ({
  redirect: redirectMock,
  notFound: notFoundMock,
  useRouter: () => ({ refresh: routerRefreshMock }),
}));

const BUDGET_PERIOD: BudgetPeriod = {
  id: "period-1",
  periodMonth: "2026-08-01",
  currency: "INR",
  plannedIncome: null,
  notes: null,
};

const ZERO_SUMMARY: BudgetSummary = {
  plannedExpense: new Decimal(0),
  actualExpense: new Decimal(0),
  remaining: new Decimal(0),
  overspent: new Decimal(0),
  plannedIncome: new Decimal(0),
  actualIncome: new Decimal(0),
  plannedSurplus: new Decimal(0),
  actualNetCashFlow: new Decimal(0),
  unbudgetedExpenseTotal: new Decimal(0),
};

beforeEach(() => {
  vi.clearAllMocks();
  getAuthenticatedUserMock.mockResolvedValue({
    id: "user-1",
    email: "asha@example.com",
  });
  getOrCreateBudgetPeriodMock.mockResolvedValue(BUDGET_PERIOD);
  getBudgetSummaryMock.mockResolvedValue(ZERO_SUMMARY);
  getBudgetCategoryProgressMock.mockResolvedValue([]);
  getUnbudgetedExpensesMock.mockResolvedValue([]);
  listCategoriesMock.mockResolvedValue([]);
});

async function renderPage(month = "2026-08") {
  const { default: BudgetMonthPage } =
    await import("@/app/app/budgets/[month]/page");
  return render(await BudgetMonthPage({ params: Promise.resolve({ month }) }));
}

describe("BudgetMonthPage", () => {
  it("shows not-found for a malformed month param", async () => {
    await expect(renderPage("not-a-month")).rejects.toThrow(/NEXT_NOT_FOUND/);
  });

  it("redirects to login when there is no authenticated user", async () => {
    getAuthenticatedUserMock.mockResolvedValue(null);

    await expect(renderPage()).rejects.toThrow(/NEXT_REDIRECT/);
  });

  it("shows not-found when the budget period cannot be created or fetched", async () => {
    getOrCreateBudgetPeriodMock.mockResolvedValue(null);

    await expect(renderPage()).rejects.toThrow(/NEXT_NOT_FOUND/);
  });

  it("shows an empty state when there are no category allocations yet", async () => {
    await renderPage();

    expect(screen.getByText("No allocations yet")).toBeInTheDocument();
  });

  it("shows the Copy previous month action", async () => {
    await renderPage();

    expect(
      screen.getByRole("button", { name: "Copy previous month" }),
    ).toBeInTheDocument();
  });

  it("renders a safe, warning, and exceeded category each with its own status label", async () => {
    getBudgetCategoryProgressMock.mockResolvedValue([
      {
        categoryId: "cat-1",
        categoryName: "Groceries",
        categoryIcon: null,
        categoryColor: null,
        plannedAmount: new Decimal(5000),
        actualAmount: new Decimal(1000),
        remainingAmount: new Decimal(4000),
        usagePercent: new Decimal(20),
        status: "safe",
      },
      {
        categoryId: "cat-2",
        categoryName: "Dining out",
        categoryIcon: null,
        categoryColor: null,
        plannedAmount: new Decimal(1000),
        actualAmount: new Decimal(900),
        remainingAmount: new Decimal(100),
        usagePercent: new Decimal(90),
        status: "warning",
      },
      {
        categoryId: "cat-3",
        categoryName: "Shopping",
        categoryIcon: null,
        categoryColor: null,
        plannedAmount: new Decimal(2000),
        actualAmount: new Decimal(2500),
        remainingAmount: new Decimal(-500),
        usagePercent: new Decimal(125),
        status: "exceeded",
      },
    ]);

    await renderPage();

    expect(screen.getByText("Groceries")).toBeInTheDocument();
    expect(screen.getByText("On track")).toBeInTheDocument();
    expect(screen.getByText("Dining out")).toBeInTheDocument();
    expect(screen.getByText("Nearing limit")).toBeInTheDocument();
    expect(screen.getByText("Shopping")).toBeInTheDocument();
    expect(screen.getByText("Over budget")).toBeInTheDocument();
  });

  it("shows unbudgeted expenses separately from category allocations", async () => {
    getUnbudgetedExpensesMock.mockResolvedValue([
      {
        categoryId: "cat-9",
        categoryName: "Travel",
        categoryIcon: null,
        categoryColor: null,
        actualAmount: new Decimal(1200),
      },
    ]);

    await renderPage();

    expect(screen.getByText("Unbudgeted expenses")).toBeInTheDocument();
    expect(screen.getByText("Travel")).toBeInTheDocument();
  });

  it("does not show the unbudgeted-expenses section when there are none", async () => {
    await renderPage();

    expect(screen.queryByText("Unbudgeted expenses")).not.toBeInTheDocument();
  });

  it("shows an 'Overspent' label with the overspent amount when remaining is negative", async () => {
    getBudgetSummaryMock.mockResolvedValue({
      ...ZERO_SUMMARY,
      plannedExpense: new Decimal(1000),
      actualExpense: new Decimal(1500),
      remaining: new Decimal(-500),
      overspent: new Decimal(500),
    });

    await renderPage();

    expect(screen.getByText("Overspent")).toBeInTheDocument();
  });
});
