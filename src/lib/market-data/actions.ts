"use server";

import { getAuthenticatedUser } from "@/lib/auth/session";
import type { MarketDataActionState } from "@/lib/market-data/action-state";
import {
  mapMarketInstrumentRow,
  type MarketInstrument,
} from "@/lib/market-data/mapping";
import {
  linkMarketInstrumentSchema,
  searchMarketInstrumentsSchema,
  unlinkMarketInstrumentSchema,
} from "@/lib/market-data/schema";
import type { MarketInstrumentKind } from "@/lib/market-data/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function readFormString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

const NOT_SIGNED_IN_MESSAGE =
  "You need to sign in again to manage market data.";
const SEARCH_FAILED_MESSAGE = "Search failed. Please try again.";
const LINK_FAILED_MESSAGE =
  "We couldn't link that instrument. Please try again.";
const UNLINK_FAILED_MESSAGE = "We couldn't remove that link. Please try again.";
const REFRESH_FAILED_MESSAGE = "We couldn't start a refresh. Please try again.";

/** Logs only a Postgrest error code, never its message (which can echo back data). */
function logMarketDataError(context: string, code: string | undefined): void {
  if (process.env.NODE_ENV === "production") {
    return;
  }
  console.error(`[market-data:${context}]`, { code: code ?? "unknown" });
}

export type MarketInstrumentSearchResult =
  | { status: "success"; results: MarketInstrument[] }
  | { status: "error"; message: string };

/** Server-side scheme/symbol search — see public.search_market_instruments. Called directly from a client combobox, not bound to a <form>. */
export async function searchMarketInstrumentsAction(
  query: string,
  instrumentKind?: MarketInstrumentKind,
): Promise<MarketInstrumentSearchResult> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { status: "error", message: NOT_SIGNED_IN_MESSAGE };
  }

  const parsed = searchMarketInstrumentsSchema.safeParse({
    query,
    instrumentKind,
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? SEARCH_FAILED_MESSAGE,
    };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("search_market_instruments", {
    p_query: parsed.data.query,
    ...(parsed.data.instrumentKind
      ? { p_instrument_kind: parsed.data.instrumentKind }
      : {}),
  });

  if (error || !data) {
    logMarketDataError("search", error?.code);
    return { status: "error", message: SEARCH_FAILED_MESSAGE };
  }

  return { status: "success", results: data.map(mapMarketInstrumentRow) };
}

/** Links an investment asset to an AMFI/stock instrument — requires p_confirm_remap=true to replace an existing different link. See public.link_investment_asset_to_market_instrument. */
export async function linkMarketInstrumentAction(
  _prevState: MarketDataActionState,
  formData: FormData,
): Promise<MarketDataActionState> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { status: "error", message: NOT_SIGNED_IN_MESSAGE };
  }

  const parsed = linkMarketInstrumentSchema.safeParse({
    assetId: readFormString(formData, "assetId"),
    marketInstrumentId: readFormString(formData, "marketInstrumentId"),
    confirmRemap: readFormString(formData, "confirmRemap"),
  });
  if (!parsed.success) {
    return { status: "error", message: LINK_FAILED_MESSAGE };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc(
    "link_investment_asset_to_market_instrument",
    {
      p_asset_id: parsed.data.assetId,
      p_market_instrument_id: parsed.data.marketInstrumentId,
      p_confirm_remap: parsed.data.confirmRemap,
    },
  );

  if (error) {
    logMarketDataError("link", error.code);
    if (error.code === "25000") {
      return {
        status: "error",
        message:
          "This investment is already linked to a different instrument. Confirm to replace the link.",
      };
    }
    if (error.code === "23514") {
      return {
        status: "error",
        message: "That instrument doesn't match this investment's kind.",
      };
    }
    return { status: "error", message: LINK_FAILED_MESSAGE };
  }

  return { status: "success", message: "Linked to market data." };
}

export async function unlinkMarketInstrumentAction(
  _prevState: MarketDataActionState,
  formData: FormData,
): Promise<MarketDataActionState> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { status: "error", message: NOT_SIGNED_IN_MESSAGE };
  }

  const parsed = unlinkMarketInstrumentSchema.safeParse({
    assetId: readFormString(formData, "assetId"),
  });
  if (!parsed.success) {
    return { status: "error", message: UNLINK_FAILED_MESSAGE };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc(
    "unlink_investment_asset_market_instrument",
    { p_asset_id: parsed.data.assetId },
  );

  if (error) {
    logMarketDataError("unlink", error.code);
    return { status: "error", message: UNLINK_FAILED_MESSAGE };
  }

  return { status: "success", message: "Market data link removed." };
}

export type RefreshSelfResult =
  | {
      status: "success";
      queued: boolean;
      retryAfterSeconds: number;
      instrumentsRequested: number;
    }
  | { status: "error"; message: string };

/** Self-scoped, cooldown-limited refresh trigger — see public.run_market_data_refresh_self. Queues an async provider refresh; the caller should poll/refresh rather than await a synchronous price update. */
export async function runMarketDataRefreshSelfAction(): Promise<RefreshSelfResult> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { status: "error", message: NOT_SIGNED_IN_MESSAGE };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("run_market_data_refresh_self");

  const row = data?.[0];
  if (error || !row) {
    logMarketDataError("refresh-self", error?.code);
    return { status: "error", message: REFRESH_FAILED_MESSAGE };
  }

  return {
    status: "success",
    queued: row.queued,
    retryAfterSeconds: row.retry_after_seconds,
    instrumentsRequested: row.instruments_requested,
  };
}
