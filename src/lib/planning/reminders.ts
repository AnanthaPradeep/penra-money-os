import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";

export const REMINDER_TYPES = [
  "goal_target_approaching",
  "emergency_fund_below_target",
  "sinking_fund_due_soon",
  "debt_payment_due",
  "debt_payment_overdue",
  "purpose_wallet_overspent",
] as const;
export type PlanningReminderType = (typeof REMINDER_TYPES)[number];

export type PlanningReminder = {
  reminderType: PlanningReminderType;
  relatedId: string;
  title: string;
  dueDate: string | null;
};

const KNOWN_TYPES = new Set<string>(REMINDER_TYPES);

/**
 * Reads public.financial_planning_reminders() — computed live from goals/
 * debts/wallets every call, never persisted (see that function's own
 * comment in supabase/migrations/20260826113424_phase12_goals_debts_
 * forecast.sql). A reminder whose type this client doesn't recognise is
 * dropped rather than shown with a guessed label — safer than crashing
 * the whole dashboard over one unexpected row.
 */
export async function getFinancialPlanningReminders(
  supabase: SupabaseClient<Database>,
): Promise<PlanningReminder[]> {
  const { data, error } = await supabase.rpc("financial_planning_reminders");
  if (error || !data) {
    return [];
  }

  const reminders: PlanningReminder[] = [];
  for (const row of data) {
    if (!KNOWN_TYPES.has(row.reminder_type)) {
      continue;
    }
    reminders.push({
      reminderType: row.reminder_type as PlanningReminderType,
      relatedId: row.related_id,
      title: row.title,
      dueDate: row.due_date,
    });
  }
  return reminders;
}
