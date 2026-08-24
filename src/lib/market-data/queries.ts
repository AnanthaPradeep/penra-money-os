import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  mapMarketDataProviderStateRow,
  mapMarketInstrumentRow,
  mapMarketPriceRow,
  mapPortfolioValueSnapshotRow,
  type MarketDataProviderState,
  type MarketInstrument,
  type MarketPrice,
  type PortfolioValueSnapshot,
} from "@/lib/market-data/mapping";
import type { Database } from "@/types/database.types";

/** Health/configuration per provider — the only market-data health surface readable from the client session; `market_data_sync_runs` deliberately has no select grant for `authenticated` (see the Phase 8 migration's RLS section). */
export async function getMarketDataProviderStates(
  supabase: SupabaseClient<Database>,
): Promise<MarketDataProviderState[]> {
  const { data, error } = await supabase
    .from("market_data_provider_state")
    .select("*")
    .order("provider", { ascending: true });

  if (error || !data) {
    return [];
  }
  return data.map(mapMarketDataProviderStateRow);
}

export async function getMarketInstrumentById(
  supabase: SupabaseClient<Database>,
  instrumentId: string,
): Promise<MarketInstrument | null> {
  const { data, error } = await supabase
    .from("market_instruments")
    .select("*")
    .eq("id", instrumentId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }
  return mapMarketInstrumentRow(data);
}

/** Batch counterpart to getMarketInstrumentById — used by watchlist/company-comparison pages that need several instruments' identity in one round trip rather than N sequential lookups. */
export async function listMarketInstrumentsByIds(
  supabase: SupabaseClient<Database>,
  instrumentIds: readonly string[],
): Promise<MarketInstrument[]> {
  if (instrumentIds.length === 0) {
    return [];
  }
  const { data, error } = await supabase
    .from("market_instruments")
    .select("*")
    .in("id", instrumentIds);

  if (error || !data) {
    return [];
  }
  return data.map(mapMarketInstrumentRow);
}

/** Every current (non-superseded) daily observation for one instrument, oldest first — used for the price/NAV history chart. Never forward-filled or interpolated. */
export async function getPriceHistoryForInstrument(
  supabase: SupabaseClient<Database>,
  instrumentId: string,
  sinceDate?: string,
): Promise<MarketPrice[]> {
  let query = supabase
    .from("market_prices")
    .select("*")
    .eq("instrument_id", instrumentId)
    .eq("is_current", true)
    .order("effective_date", { ascending: true });

  if (sinceDate) {
    query = query.gte("effective_date", sinceDate);
  }

  const { data, error } = await query;
  if (error || !data) {
    return [];
  }
  return data.map(mapMarketPriceRow);
}

/** Daily portfolio-value history for one currency group, oldest first — used for the portfolio-value history chart. Only real, stored snapshots; gaps are never filled in. */
export async function getPortfolioValueSnapshots(
  supabase: SupabaseClient<Database>,
  currency: string,
  sinceDate?: string,
): Promise<PortfolioValueSnapshot[]> {
  let query = supabase
    .from("portfolio_value_snapshots")
    .select("*")
    .eq("currency", currency)
    .order("snapshot_date", { ascending: true });

  if (sinceDate) {
    query = query.gte("snapshot_date", sinceDate);
  }

  const { data, error } = await query;
  if (error || !data) {
    return [];
  }
  return data.map(mapPortfolioValueSnapshotRow);
}
