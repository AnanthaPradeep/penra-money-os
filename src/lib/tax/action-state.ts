/** Shared action-state shape for tax-workspace Server Actions — see src/lib/auth/action-state.ts for why this lives outside the "use server" module. */
export type TaxActionState =
  | { status: "idle" }
  | { status: "error"; message: string; fieldErrors?: Record<string, string> }
  | { status: "success"; message: string };

export const INITIAL_TAX_ACTION_STATE: TaxActionState = {
  status: "idle",
};
