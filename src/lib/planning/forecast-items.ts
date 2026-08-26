import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getBudgetSummary } from "@/lib/budgets/queries";
import { listDebts, listDebtPaymentSchedule } from "@/lib/debts/queries";
import { listFinancialGoals } from "@/lib/goals/queries";
import { Decimal } from "@/lib/money/decimal";
import { getUpcomingMaturityEvents } from "@/lib/investments/queries";
import type { ForecastCashFlowItem } from "@/lib/planning/forecast";
import { listOccurrencesWithItems } from "@/lib/recurring/queries";
import { getSafeToSpendSummary } from "@/lib/wallets/queries";
import type { Database } from "@/types/database.types";

/**
 * Assembles the candidate cash-flow items a forecast may draw from — the
 * one place in the app that decides what counts as real, already-
 * scheduled money movement. Deliberately does NOT read: unposted/staged
 * bank-import rows (statement_import_rows), AI job output
 * (research_ai_jobs / ipo events), watchlist/IPO research notes, or any
 * manually-entered investment valuation change — none of those are
 * queried here at all, so they cannot leak into a forecast by omission
 * elsewhere. Transfers (recurring_items.kind = 'transfer') are excluded
 * outright rather than included and relied upon to net to zero, since a
 * transfer can move money between an eligible-liquid account and a
 * non-eligible one (e.g. into a credit card or investment account).
 */

const MONTH_END_DAY = 31;

function endOfMonthIso(periodMonth: string): string {
  const [year, month] = periodMonth.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year ?? 0, month ?? 1, 0)).getUTCDate();
  return `${periodMonth}-${String(Math.min(lastDay, MONTH_END_DAY)).padStart(2, "0")}`;
}

export type ForecastCandidateData = {
  openingBalance: Decimal;
  items: ForecastCashFlowItem[];
  dataCompleteness: {
    hasRecurringItems: boolean;
    hasDebts: boolean;
    hasBudget: boolean;
    hasGoals: boolean;
  };
};

/** Gathers real eligible-liquid balance plus every candidate cash-flow item within [asOf, asOf+horizonDays], for src/lib/planning/forecast.ts to consume. */
export async function getForecastCandidateData(
  supabase: SupabaseClient<Database>,
  asOf: string,
  currency = "INR",
): Promise<ForecastCandidateData> {
  const [
    safeToSpend,
    occurrences,
    debts,
    goals,
    maturities,
    currentMonthBudget,
  ] = await Promise.all([
    getSafeToSpendSummary(supabase, currency),
    listOccurrencesWithItems(supabase, "all"),
    listDebts(supabase, { includeClosed: false }),
    listFinancialGoals(supabase, { includeArchived: false }),
    getUpcomingMaturityEvents(supabase, 730),
    getBudgetSummary(supabase, asOf.slice(0, 7)),
  ]);

  const items: ForecastCashFlowItem[] = [];

  const linkedRecurringItemIds = new Set(
    goals
      .map((g) => g.sfLinkedRecurringItemId)
      .filter((id): id is string => id !== null),
  );

  for (const occurrence of occurrences) {
    if (occurrence.itemKind === "transfer") {
      continue;
    }
    const confidence =
      occurrence.status === "due" ||
      occurrence.status === "overdue" ||
      occurrence.status === "failed"
        ? "confirmed"
        : "expected";
    const isLinkedGoalContribution = linkedRecurringItemIds.has(
      occurrence.recurringItemId,
    );
    items.push({
      id: `occurrence:${occurrence.id}`,
      kind: isLinkedGoalContribution
        ? "goal_contribution"
        : occurrence.itemKind === "income"
          ? "recurring_income"
          : "recurring_bill",
      label: occurrence.itemName,
      date: occurrence.scheduledDate,
      amount:
        occurrence.itemKind === "income"
          ? occurrence.amount.abs()
          : occurrence.amount.abs().negated(),
      confidence,
    });
  }

  const debtById = new Map(debts.map((d) => [d.id, d]));
  const scheduleResults = await Promise.all(
    debts
      .filter((d) => d.status === "active")
      .map((d) => listDebtPaymentSchedule(supabase, d.id)),
  );
  for (const schedule of scheduleResults) {
    for (const row of schedule) {
      const debt = debtById.get(row.debtId);
      if (!debt) {
        continue;
      }
      items.push({
        id: `debt-schedule:${row.id}`,
        kind: "debt_minimum_payment",
        label: `${debt.name} payment`,
        date: row.dueDate,
        amount: row.scheduledPayment.negated(),
        confidence: "confirmed",
      });
    }
  }

  for (const event of maturities) {
    if (event.expectedMaturityAmount === null) {
      continue;
    }
    items.push({
      id: `maturity:${event.holdingId}`,
      kind: "investment_maturity",
      label: `${event.displayName} maturity`,
      date: event.maturityDate,
      amount: event.expectedMaturityAmount,
      confidence: "expected",
    });
  }

  if (currentMonthBudget.remaining.gt(0)) {
    items.push({
      id: `budget:${asOf.slice(0, 7)}`,
      kind: "budget_spending",
      label: "Remaining planned budget this month",
      date: endOfMonthIso(asOf.slice(0, 7)),
      amount: currentMonthBudget.remaining.negated(),
      confidence: "expected",
    });
  }

  return {
    openingBalance: safeToSpend?.eligibleLiquidBalance ?? new Decimal(0),
    items,
    dataCompleteness: {
      hasRecurringItems: occurrences.length > 0,
      hasDebts: debts.length > 0,
      hasBudget: currentMonthBudget.plannedExpense.gt(0),
      hasGoals: goals.length > 0,
    },
  };
}
