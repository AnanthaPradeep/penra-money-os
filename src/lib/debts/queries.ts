import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  mapDebtPaymentRow,
  mapDebtPaymentScheduleRow,
  mapDebtRateHistoryRow,
  mapDebtRow,
  type Debt,
  type DebtPayment,
  type DebtPaymentScheduleRowItem,
  type DebtRateHistoryEntry,
} from "@/lib/debts/mapping";
import { Decimal, type Money } from "@/lib/money/decimal";
import type { Database } from "@/types/database.types";

/** Lists the caller's own debts, active first. */
export async function listDebts(
  supabase: SupabaseClient<Database>,
  options: { includeClosed?: boolean } = {},
): Promise<Debt[]> {
  let query = supabase
    .from("debts")
    .select("*")
    .order("status", { ascending: true })
    .order("name", { ascending: true });

  if (!options.includeClosed) {
    query = query.not("status", "in", "(closed,archived)");
  }

  const { data, error } = await query;
  if (error || !data) {
    return [];
  }
  return data.map(mapDebtRow);
}

/** Reads a single debt owned by the caller. */
export async function getDebt(
  supabase: SupabaseClient<Database>,
  debtId: string,
): Promise<Debt | null> {
  const { data, error } = await supabase
    .from("debts")
    .select("*")
    .eq("id", debtId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }
  return mapDebtRow(data);
}

/** The debt's current outstanding principal, derived live from account_balances via public.debt_current_principal. */
export async function getDebtCurrentPrincipal(
  supabase: SupabaseClient<Database>,
  debtId: string,
): Promise<Money> {
  const { data, error } = await supabase.rpc("debt_current_principal", {
    p_debt_id: debtId,
  });

  if (error || data === null) {
    return new Decimal(0);
  }
  return new Decimal(data);
}

/** Full interest-rate history for a debt, newest first. */
export async function listDebtRateHistory(
  supabase: SupabaseClient<Database>,
  debtId: string,
): Promise<DebtRateHistoryEntry[]> {
  const { data, error } = await supabase
    .from("debt_rate_history")
    .select("*")
    .eq("debt_id", debtId)
    .order("effective_date", { ascending: false });

  if (error || !data) {
    return [];
  }
  return data.map(mapDebtRateHistoryRow);
}

/** The full generated amortization schedule for a debt, in installment order. */
export async function listDebtPaymentSchedule(
  supabase: SupabaseClient<Database>,
  debtId: string,
): Promise<DebtPaymentScheduleRowItem[]> {
  const { data, error } = await supabase
    .from("debt_payment_schedules")
    .select("*")
    .eq("debt_id", debtId)
    .order("installment_number", { ascending: true });

  if (error || !data) {
    return [];
  }
  return data.map(mapDebtPaymentScheduleRow);
}

/** Payment history for a debt, newest first. */
export async function listDebtPayments(
  supabase: SupabaseClient<Database>,
  debtId: string,
): Promise<DebtPayment[]> {
  const { data, error } = await supabase
    .from("debt_payments")
    .select("*")
    .eq("debt_id", debtId)
    .order("effective_date", { ascending: false });

  if (error || !data) {
    return [];
  }
  return data.map(mapDebtPaymentRow);
}

export type DebtDetail = {
  debt: Debt;
  currentPrincipal: Money;
  rateHistory: DebtRateHistoryEntry[];
  schedule: DebtPaymentScheduleRowItem[];
  payments: DebtPayment[];
};

/** Reads everything a debt detail page needs in one batch. */
export async function getDebtDetail(
  supabase: SupabaseClient<Database>,
  debtId: string,
): Promise<DebtDetail | null> {
  const debt = await getDebt(supabase, debtId);
  if (!debt) {
    return null;
  }

  const [currentPrincipal, rateHistory, schedule, payments] = await Promise.all(
    [
      getDebtCurrentPrincipal(supabase, debtId),
      listDebtRateHistory(supabase, debtId),
      listDebtPaymentSchedule(supabase, debtId),
      listDebtPayments(supabase, debtId),
    ],
  );

  return { debt, currentPrincipal, rateHistory, schedule, payments };
}

export type UpcomingDebtPayment = {
  debtId: string;
  debtName: string;
  dueDate: string;
  scheduledPayment: Money;
};

/**
 * The single soonest unpaid installment across every active debt — for
 * the dashboard's "next payment" card. Fetches a small batch of the
 * nearest-due schedule rows plus every already-posted payment's
 * schedule_row_id, then filters in memory rather than expressing "no
 * matching debt_payments row" as a single PostgREST query.
 */
export async function getNextUpcomingDebtPayment(
  supabase: SupabaseClient<Database>,
): Promise<UpcomingDebtPayment | null> {
  const { data: scheduleRows, error: scheduleError } = await supabase
    .from("debt_payment_schedules")
    .select("id, debt_id, due_date, scheduled_payment, debts(name, status)")
    .order("due_date", { ascending: true })
    .limit(50);

  if (scheduleError || !scheduleRows) {
    return null;
  }

  const { data: paidRows } = await supabase
    .from("debt_payments")
    .select("schedule_row_id")
    .not("schedule_row_id", "is", null);
  const paidScheduleRowIds = new Set(
    (paidRows ?? [])
      .map((row) => row.schedule_row_id)
      .filter((id): id is string => id !== null),
  );

  for (const row of scheduleRows) {
    if (row.debts?.status !== "active") {
      continue;
    }
    if (paidScheduleRowIds.has(row.id)) {
      continue;
    }
    return {
      debtId: row.debt_id,
      debtName: row.debts.name,
      dueDate: row.due_date,
      scheduledPayment: new Decimal(row.scheduled_payment),
    };
  }
  return null;
}
