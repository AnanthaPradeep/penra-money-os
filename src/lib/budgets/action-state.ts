/** Shared action-state shape for budget Server Actions — see src/lib/auth/action-state.ts for why this lives outside the "use server" module. */
export type BudgetActionState =
  | { status: "idle" }
  | { status: "error"; message: string; fieldErrors?: Record<string, string> }
  | { status: "success"; message: string };

export const INITIAL_BUDGET_ACTION_STATE: BudgetActionState = {
  status: "idle",
};
