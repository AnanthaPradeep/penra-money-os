/** Shared action-state shape for investment/net-worth Server Actions — see src/lib/auth/action-state.ts for why this lives outside the "use server" module. */
export type InvestmentActionState =
  | { status: "idle" }
  | { status: "error"; message: string; fieldErrors?: Record<string, string> }
  | { status: "success"; message: string; holdingId?: string };

export const INITIAL_INVESTMENT_ACTION_STATE: InvestmentActionState = {
  status: "idle",
};
