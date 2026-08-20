import { Decimal, type Money } from "@/lib/money/decimal";
import { isOneOf } from "@/lib/types/literal";
import type { BudgetPeriodRow } from "@/lib/budgets/types";

export type BudgetPeriod = {
  id: string;
  periodMonth: string;
  currency: string;
  plannedIncome: Money | null;
  notes: string | null;
};

export function mapBudgetPeriodRow(row: BudgetPeriodRow): BudgetPeriod {
  return {
    id: row.id,
    periodMonth: row.period_month,
    currency: row.currency,
    plannedIncome:
      row.planned_income !== null ? new Decimal(row.planned_income) : null,
    notes: row.notes,
  };
}

export type BudgetSummary = {
  plannedExpense: Money;
  actualExpense: Money;
  remaining: Money;
  overspent: Money;
  plannedIncome: Money;
  actualIncome: Money;
  plannedSurplus: Money;
  actualNetCashFlow: Money;
  unbudgetedExpenseTotal: Money;
};

export const BUDGET_PROGRESS_STATUSES = [
  "safe",
  "warning",
  "reached",
  "exceeded",
] as const;
export type BudgetProgressStatus = (typeof BUDGET_PROGRESS_STATUSES)[number];

export type CategoryBudgetProgress = {
  categoryId: string;
  categoryName: string;
  categoryIcon: string | null;
  categoryColor: string | null;
  plannedAmount: Money;
  actualAmount: Money;
  remainingAmount: Money;
  /** null when plannedAmount is zero — see budget_category_progress (supabase/migrations) for why no percentage is meaningful there. */
  usagePercent: Money | null;
  status: BudgetProgressStatus;
};

/** Raw shape returned by public.budget_category_progress — icon/color/category_id are defensively treated as nullable regardless of what the generated type claims, since a hand-written SQL function's nullability is not always inferred correctly by codegen. */
type CategoryBudgetProgressRow = {
  category_id: string | null;
  category_name: string | null;
  category_icon: string | null;
  category_color: string | null;
  planned_amount: number;
  actual_amount: number;
  remaining_amount: number;
  usage_percent: number | null;
  progress_status: string | null;
};

export function mapCategoryBudgetProgressRow(
  row: CategoryBudgetProgressRow,
): CategoryBudgetProgress | null {
  if (row.category_id === null || row.category_name === null) {
    return null;
  }
  const status =
    row.progress_status !== null &&
    isOneOf(row.progress_status, BUDGET_PROGRESS_STATUSES)
      ? row.progress_status
      : "safe";
  return {
    categoryId: row.category_id,
    categoryName: row.category_name,
    categoryIcon: row.category_icon,
    categoryColor: row.category_color,
    plannedAmount: new Decimal(row.planned_amount),
    actualAmount: new Decimal(row.actual_amount),
    remainingAmount: new Decimal(row.remaining_amount),
    usagePercent:
      row.usage_percent !== null ? new Decimal(row.usage_percent) : null,
    status,
  };
}

export type UnbudgetedExpense = {
  categoryId: string | null;
  categoryName: string;
  categoryIcon: string | null;
  categoryColor: string | null;
  actualAmount: Money;
};

type UnbudgetedExpenseRow = {
  category_id: string | null;
  category_name: string | null;
  category_icon: string | null;
  category_color: string | null;
  actual_amount: number;
};

export function mapUnbudgetedExpenseRow(
  row: UnbudgetedExpenseRow,
): UnbudgetedExpense {
  return {
    categoryId: row.category_id,
    categoryName: row.category_name ?? "Uncategorized",
    categoryIcon: row.category_icon,
    categoryColor: row.category_color,
    actualAmount: new Decimal(row.actual_amount),
  };
}
