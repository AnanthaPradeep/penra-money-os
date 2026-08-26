import type { Tables } from "@/types/database.types";

/** A row of `public.debts` (see supabase/migrations/20260826113424_phase12_goals_debts_forecast.sql). */
export type DebtRow = Tables<"debts">;

/** A row of `public.debt_rate_history` — append-only, never updated or deleted. */
export type DebtRateHistoryRow = Tables<"debt_rate_history">;

/** A row of `public.debt_payment_schedules` — a projection until a debt_payments row references it. */
export type DebtPaymentScheduleRow = Tables<"debt_payment_schedules">;

/** A row of `public.debt_payments`. */
export type DebtPaymentRow = Tables<"debt_payments">;
