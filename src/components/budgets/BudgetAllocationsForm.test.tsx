import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const refreshMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

vi.mock("@/lib/budgets/actions", () => ({
  saveBudgetAllocationsAction: vi.fn(),
}));

import { BudgetAllocationsForm } from "@/components/budgets/BudgetAllocationsForm";
import { Decimal } from "@/lib/money/decimal";

const EXPENSE_CATEGORIES = [
  { id: "cat-1", name: "Groceries" },
  { id: "cat-2", name: "Dining out" },
];

describe("BudgetAllocationsForm", () => {
  it("renders one amount input per expense category, named amount:<categoryId>", () => {
    render(
      <BudgetAllocationsForm
        budgetPeriodId="period-1"
        expenseCategories={EXPENSE_CATEGORIES}
        existingProgress={[]}
        defaultPlannedIncome=""
      />,
    );

    const groceries = screen.getByLabelText("Groceries");
    const dining = screen.getByLabelText("Dining out");
    expect(groceries).toHaveAttribute("name", "amount:cat-1");
    expect(dining).toHaveAttribute("name", "amount:cat-2");
  });

  it("defaults a category's input to its existing planned amount when progress already exists", () => {
    render(
      <BudgetAllocationsForm
        budgetPeriodId="period-1"
        expenseCategories={EXPENSE_CATEGORIES}
        existingProgress={[
          {
            categoryId: "cat-1",
            categoryName: "Groceries",
            categoryIcon: null,
            categoryColor: null,
            plannedAmount: new Decimal(5000),
            actualAmount: new Decimal(2000),
            remainingAmount: new Decimal(3000),
            usagePercent: new Decimal(40),
            status: "safe",
          },
        ]}
        defaultPlannedIncome=""
      />,
    );

    expect(screen.getByLabelText("Groceries")).toHaveValue("5000");
    expect(screen.getByLabelText("Dining out")).toHaveValue("0");
  });

  it("defaults an unallocated category's input to zero, not blank", () => {
    render(
      <BudgetAllocationsForm
        budgetPeriodId="period-1"
        expenseCategories={EXPENSE_CATEGORIES}
        existingProgress={[]}
        defaultPlannedIncome=""
      />,
    );

    expect(screen.getByLabelText("Groceries")).toHaveValue("0");
  });

  it("prefills the planned income field", () => {
    render(
      <BudgetAllocationsForm
        budgetPeriodId="period-1"
        expenseCategories={EXPENSE_CATEGORIES}
        existingProgress={[]}
        defaultPlannedIncome="75000"
      />,
    );

    expect(screen.getByLabelText("Planned income (optional)")).toHaveValue(
      "75000",
    );
  });

  it("carries the budget period id as a hidden field", () => {
    const { container } = render(
      <BudgetAllocationsForm
        budgetPeriodId="period-abc"
        expenseCategories={EXPENSE_CATEGORIES}
        existingProgress={[]}
        defaultPlannedIncome=""
      />,
    );

    const hidden = container.querySelector('input[name="budgetPeriodId"]');
    expect(hidden).toHaveValue("period-abc");
  });

  it("renders an empty state gracefully with no expense categories", () => {
    render(
      <BudgetAllocationsForm
        budgetPeriodId="period-1"
        expenseCategories={[]}
        existingProgress={[]}
        defaultPlannedIncome=""
      />,
    );

    expect(
      screen.getByRole("button", { name: "Save budget" }),
    ).toBeInTheDocument();
  });
});
