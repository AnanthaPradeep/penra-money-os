import type { Tables } from "@/types/database.types";

export type MarketInstrumentRow = Tables<"market_instruments">;
export type MarketPriceRow = Tables<"market_prices">;
export type MarketDataProviderStateRow = Tables<"market_data_provider_state">;
export type PortfolioValueSnapshotRow = Tables<"portfolio_value_snapshots">;

/** Every source `public.market_instruments.provider` can hold — see the Phase 8 migration's CHECK constraint. */
export const MARKET_DATA_PROVIDERS = ["amfi", "twelve_data"] as const;
export type MarketDataProvider = (typeof MARKET_DATA_PROVIDERS)[number];

export const MARKET_DATA_PROVIDER_LABELS: Record<MarketDataProvider, string> = {
  amfi: "AMFI (official mutual-fund NAV)",
  twelve_data: "Twelve Data (stock prices)",
};

export const MARKET_INSTRUMENT_KINDS = ["stock", "mutual_fund"] as const;
export type MarketInstrumentKind = (typeof MARKET_INSTRUMENT_KINDS)[number];

export const MARKET_PRICE_KINDS = ["close", "nav", "latest"] as const;
export type MarketPriceKind = (typeof MARKET_PRICE_KINDS)[number];

/**
 * What `investment_holding_summary.valuation_source` can hold — a provider name
 * when a fresh-enough `market_prices` row drove the valuation, "manual" when a
 * Phase 7 manual valuation was used instead, or "none" when neither exists and
 * the holding falls back to cost basis. Never a live/streaming source.
 */
export const HOLDING_VALUATION_SOURCES = [
  "amfi",
  "twelve_data",
  "manual",
  "none",
] as const;
export type HoldingValuationSource = (typeof HOLDING_VALUATION_SOURCES)[number];

export const HOLDING_VALUATION_SOURCE_LABELS: Record<
  HoldingValuationSource,
  string
> = {
  amfi: "AMFI NAV",
  twelve_data: "Twelve Data",
  manual: "Manual valuation",
  none: "No valuation",
};

/** Coarse staleness classifier shared by provider prices and manual valuations — see public.market_price_status. */
export const MARKET_PRICE_STATUSES = [
  "fresh",
  "delayed",
  "stale",
  "missing",
] as const;
export type MarketPriceStatus = (typeof MARKET_PRICE_STATUSES)[number];

export const MARKET_PRICE_STATUS_LABELS: Record<MarketPriceStatus, string> = {
  fresh: "Fresh",
  delayed: "Delayed",
  stale: "Stale",
  missing: "Missing",
};

export const MARKET_DATA_SYNC_STATUSES = [
  "running",
  "success",
  "partial",
  "failed",
  "skipped",
] as const;
export type MarketDataSyncStatus = (typeof MARKET_DATA_SYNC_STATUSES)[number];
