/** Shared action-state shape for ledger transaction Server Actions — see src/lib/auth/action-state.ts for why this lives outside the "use server" module. */
export type TransactionActionState =
  | { status: "idle" }
  | { status: "error"; message: string; fieldErrors?: Record<string, string> };

export const INITIAL_TRANSACTION_ACTION_STATE: TransactionActionState = {
  status: "idle",
};
