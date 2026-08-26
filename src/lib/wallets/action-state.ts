/** Shared action-state shape for purpose-wallet and income-allocation-plan Server Actions — see src/lib/auth/action-state.ts for why this lives outside the "use server" module. */
export type WalletActionState =
  | { status: "idle" }
  | { status: "error"; message: string; fieldErrors?: Record<string, string> }
  | { status: "success"; message: string };

export const INITIAL_WALLET_ACTION_STATE: WalletActionState = {
  status: "idle",
};
