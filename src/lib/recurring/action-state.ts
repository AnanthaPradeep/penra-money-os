/** Shared action-state shape for recurring-item Server Actions — see src/lib/auth/action-state.ts for why this lives outside the "use server" module. */
export type RecurringActionState =
  | { status: "idle" }
  | { status: "error"; message: string; fieldErrors?: Record<string, string> }
  | { status: "success"; message: string; recurringItemId?: string };

export const INITIAL_RECURRING_ACTION_STATE: RecurringActionState = {
  status: "idle",
};
