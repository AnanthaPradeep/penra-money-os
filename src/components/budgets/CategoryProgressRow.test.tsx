import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CategoryProgressRow } from "@/components/budgets/CategoryProgressRow";
import type { CategoryBudgetProgress } from "@/lib/budgets/mapping";
import { Decimal } from "@/lib/money/decimal";

function progress(
  overrides: Partial<CategoryBudgetProgress>,
): CategoryBudgetProgress {
  return {
    categoryId: "cat-1",
    categoryName: "Groceries",
    categoryIcon: null,
    categoryColor: "#22c55e",
    plannedAmount: new Decimal(5000),
    actualAmount: new Decimal(2000),
    remainingAmount: new Decimal(3000),
    usagePercent: new Decimal(40),
    status: "safe",
    ...overrides,
  };
}

describe("CategoryProgressRow", () => {
  it("shows 'On track' and remaining amount for a safe (<80%) category", () => {
    render(<CategoryProgressRow progress={progress({})} />);

    expect(screen.getByText("On track")).toBeInTheDocument();
    expect(screen.getByText("3000 left")).toBeInTheDocument();
    expect(
      screen.getByRole("progressbar", { name: "Groceries budget usage" }),
    ).toHaveAttribute("aria-valuenow", "40");
  });

  it("shows 'Nearing limit' for a warning (80-99%) category", () => {
    render(
      <CategoryProgressRow
        progress={progress({
          status: "warning",
          plannedAmount: new Decimal(1000),
          actualAmount: new Decimal(900),
          remainingAmount: new Decimal(100),
          usagePercent: new Decimal(90),
        })}
      />,
    );

    expect(screen.getByText("Nearing limit")).toBeInTheDocument();
  });

  it("shows 'At limit' for a reached (100%) category", () => {
    render(
      <CategoryProgressRow
        progress={progress({
          status: "reached",
          plannedAmount: new Decimal(1000),
          actualAmount: new Decimal(1000),
          remainingAmount: new Decimal(0),
          usagePercent: new Decimal(100),
        })}
      />,
    );

    expect(screen.getByText("At limit")).toBeInTheDocument();
  });

  it("shows 'Over budget' and the overspent amount for an exceeded category", () => {
    render(
      <CategoryProgressRow
        progress={progress({
          status: "exceeded",
          plannedAmount: new Decimal(2000),
          actualAmount: new Decimal(2500),
          remainingAmount: new Decimal(-500),
          usagePercent: new Decimal(125),
        })}
      />,
    );

    expect(screen.getByText("Over budget")).toBeInTheDocument();
    expect(screen.getByText("500 over")).toBeInTheDocument();
  });

  it("caps the progress bar at 100% even when usage is far over budget", () => {
    render(
      <CategoryProgressRow
        progress={progress({
          status: "exceeded",
          plannedAmount: new Decimal(1000),
          actualAmount: new Decimal(3000),
          remainingAmount: new Decimal(-2000),
          usagePercent: new Decimal(300),
        })}
      />,
    );

    expect(
      screen.getByRole("progressbar", { name: "Groceries budget usage" }),
    ).toHaveAttribute("aria-valuenow", "100");
  });

  it("shows a zero-width, zero-percent bar for a zero-allocation, zero-actual category (safe by default, no division by zero)", () => {
    render(
      <CategoryProgressRow
        progress={progress({
          status: "safe",
          plannedAmount: new Decimal(0),
          actualAmount: new Decimal(0),
          remainingAmount: new Decimal(0),
          usagePercent: null,
        })}
      />,
    );

    expect(
      screen.getByRole("progressbar", { name: "Groceries budget usage" }),
    ).toHaveAttribute("aria-valuenow", "0");
  });
});
