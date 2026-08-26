/** Shared action-state shape for debt/loan Server Actions — see src/lib/auth/action-state.ts for why this lives outside the "use server" module. */
export type DebtActionState =
  | { status: "idle" }
  | { status: "error"; message: string; fieldErrors?: Record<string, string> }
  | { status: "success"; message: string };

export const INITIAL_DEBT_ACTION_STATE: DebtActionState = {
  status: "idle",
};
