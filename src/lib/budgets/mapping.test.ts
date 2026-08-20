import { describe, expect, it } from "vitest";

import {
  mapCategoryBudgetProgressRow,
  mapUnbudgetedExpenseRow,
} from "@/lib/budgets/mapping";

describe("mapCategoryBudgetProgressRow", () => {
  it("returns null when the underlying category id is missing (a row this should never happen for, defended anyway)", () => {
    const result = mapCategoryBudgetProgressRow({
      category_id: null,
      category_name: "Anything",
      category_icon: null,
      category_color: null,
      planned_amount: 100,
      actual_amount: 50,
      remaining_amount: 50,
      usage_percent: 50,
      progress_status: "safe",
    });
    expect(result).toBeNull();
  });

  it("maps a normal in-budget row to 'safe' with a computed usage percent", () => {
    const result = mapCategoryBudgetProgressRow({
      category_id: "cat-1",
      category_name: "Groceries",
      category_icon: "shopping-cart",
      category_color: "#22c55e",
      planned_amount: 5000,
      actual_amount: 2000,
      remaining_amount: 3000,
      usage_percent: 40,
      progress_status: "safe",
    });
    expect(result).not.toBeNull();
    expect(result?.status).toBe("safe");
    expect(result?.usagePercent?.toString()).toBe("40");
    expect(result?.plannedAmount.toString()).toBe("5000");
    expect(result?.actualAmount.toString()).toBe("2000");
  });

  it("handles a zero-planned allocation without a usage percent (division by zero avoided upstream in SQL, mapped through as null here)", () => {
    const result = mapCategoryBudgetProgressRow({
      category_id: "cat-2",
      category_name: "New category",
      category_icon: null,
      category_color: null,
      planned_amount: 0,
      actual_amount: 0,
      remaining_amount: 0,
      usage_percent: null,
      progress_status: "safe",
    });
    expect(result?.usagePercent).toBeNull();
    expect(result?.status).toBe("safe");
  });

  it("maps an exceeded (overspent) allocation", () => {
    const result = mapCategoryBudgetProgressRow({
      category_id: "cat-3",
      category_name: "Dining out",
      category_icon: null,
      category_color: null,
      planned_amount: 2000,
      actual_amount: 2500,
      remaining_amount: -500,
      usage_percent: 125,
      progress_status: "exceeded",
    });
    expect(result?.status).toBe("exceeded");
    expect(result?.remainingAmount.isNegative()).toBe(true);
  });

  it("falls back to 'safe' when the database reports an unrecognized status (defensive, should never happen given the CHECK constraint)", () => {
    const result = mapCategoryBudgetProgressRow({
      category_id: "cat-4",
      category_name: "Odd",
      category_icon: null,
      category_color: null,
      planned_amount: 100,
      actual_amount: 10,
      remaining_amount: 90,
      usage_percent: 10,
      progress_status: "not-a-real-status",
    });
    expect(result?.status).toBe("safe");
  });
});

describe("mapUnbudgetedExpenseRow", () => {
  it("labels a null category as Uncategorized", () => {
    const result = mapUnbudgetedExpenseRow({
      category_id: null,
      category_name: null,
      category_icon: null,
      category_color: null,
      actual_amount: 500,
    });
    expect(result.categoryId).toBeNull();
    expect(result.categoryName).toBe("Uncategorized");
    expect(result.actualAmount.toString()).toBe("500");
  });

  it("passes through a real category's name", () => {
    const result = mapUnbudgetedExpenseRow({
      category_id: "cat-5",
      category_name: "Travel",
      category_icon: "plane",
      category_color: "#3b82f6",
      actual_amount: 1200,
    });
    expect(result.categoryName).toBe("Travel");
    expect(result.categoryIcon).toBe("plane");
  });
});
