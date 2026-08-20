import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  mapBudgetPeriodRow,
  mapCategoryBudgetProgressRow,
  mapUnbudgetedExpenseRow,
  type BudgetPeriod,
  type BudgetSummary,
  type CategoryBudgetProgress,
  type UnbudgetedExpense,
} from "@/lib/budgets/mapping";
import { Decimal } from "@/lib/money/decimal";
import type { Database } from "@/types/database.types";

/** Fetches (creating on first access) the caller's budget period for a calendar month — see public.get_or_create_budget_period. */
export async function getOrCreateBudgetPeriod(
  supabase: SupabaseClient<Database>,
  periodMonth: string,
): Promise<BudgetPeriod | null> {
  const { data, error } = await supabase.rpc("get_or_create_budget_period", {
    p_period_month: periodMonth,
  });

  if (error || !data) {
    return null;
  }

  return mapBudgetPeriodRow(data);
}

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

/** Whole-period budget totals for a calendar month — see public.budget_summary. */
export async function getBudgetSummary(
  supabase: SupabaseClient<Database>,
  periodMonth: string,
): Promise<BudgetSummary> {
  const { data, error } = await supabase
    .rpc("budget_summary", { p_period_month: periodMonth })
    .maybeSingle();

  if (error || !data) {
    return ZERO_SUMMARY;
  }

  return {
    plannedExpense: new Decimal(data.planned_expense),
    actualExpense: new Decimal(data.actual_expense),
    remaining: new Decimal(data.remaining),
    overspent: new Decimal(data.overspent),
    plannedIncome: new Decimal(data.planned_income),
    actualIncome: new Decimal(data.actual_income),
    plannedSurplus: new Decimal(data.planned_surplus),
    actualNetCashFlow: new Decimal(data.actual_net_cash_flow),
    unbudgetedExpenseTotal: new Decimal(data.unbudgeted_expense_total),
  };
}

/** Per-category planned vs. actual for a calendar month — see public.budget_category_progress. */
export async function getBudgetCategoryProgress(
  supabase: SupabaseClient<Database>,
  periodMonth: string,
): Promise<CategoryBudgetProgress[]> {
  const { data, error } = await supabase.rpc("budget_category_progress", {
    p_period_month: periodMonth,
  });

  if (error || !data) {
    return [];
  }

  const rows: CategoryBudgetProgress[] = [];
  for (const row of data) {
    const mapped = mapCategoryBudgetProgressRow(row);
    if (mapped) {
      rows.push(mapped);
    }
  }
  return rows;
}

/** Expense-category spend with no allocation for a calendar month — see public.budget_unbudgeted_expenses. */
export async function getUnbudgetedExpenses(
  supabase: SupabaseClient<Database>,
  periodMonth: string,
): Promise<UnbudgetedExpense[]> {
  const { data, error } = await supabase.rpc("budget_unbudgeted_expenses", {
    p_period_month: periodMonth,
  });

  if (error || !data) {
    return [];
  }

  return data.map(mapUnbudgetedExpenseRow);
}
