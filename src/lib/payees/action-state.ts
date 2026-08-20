/** Shared action-state shape for payee Server Actions — see src/lib/auth/action-state.ts for why this lives outside the "use server" module. */
export type PayeeActionState =
  | { status: "idle" }
  | { status: "error"; message: string; fieldErrors?: Record<string, string> }
  | { status: "success"; message: string; payee: { id: string; name: string } };

export const INITIAL_PAYEE_ACTION_STATE: PayeeActionState = {
  status: "idle",
};
