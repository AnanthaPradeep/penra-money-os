/** Shared action-state shape for market-data linking Server Actions — see src/lib/auth/action-state.ts for why this lives outside the "use server" module. */
export type MarketDataActionState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success"; message: string };

export const INITIAL_MARKET_DATA_ACTION_STATE: MarketDataActionState = {
  status: "idle",
};
