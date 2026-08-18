/** Shared action-state shape for account Server Actions — see src/lib/auth/action-state.ts for why this lives outside the "use server" module. */
export type AccountActionState =
  | { status: "idle" }
  | { status: "error"; message: string; fieldErrors?: Record<string, string> };

export const INITIAL_ACCOUNT_ACTION_STATE: AccountActionState = {
  status: "idle",
};
