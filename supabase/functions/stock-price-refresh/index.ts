// Deno Edge Function — refreshes latest stock prices from a configured
// stock-market data provider (Twelve Data: https://twelvedata.com/docs#price).
//
// IMPORTANT: no TWELVE_DATA_API_KEY secret exists in this environment. The
// "not configured" boundary below (checked first, before any network call)
// is the path that actually runs today, and it is fully implemented and
// safe to invoke — it records a `skipped` sync run and leaves every
// manually-tracked/manually-valued holding untouched. The provider-call
// path beneath it is written against Twelve Data's documented `/price`
// contract and is ready to activate the moment an operator sets the
// secret, but it has never been exercised against the real API and must
// not be reported as tested or working until it has.
//
// Invoked the same way as amfi-nav-refresh: by pg_cron via
// public.process_stock_price_refresh_all -> public.run_stock_price_refresh
// -> pg_net, or indirectly by a user's self-scoped refresh request. Never
// called directly by a browser.
import { createClient } from "npm:@supabase/supabase-js@2";

import type { Database } from "../_shared/database.types.ts";
import { recordProviderAttempt } from "../_shared/provider-state.ts";
import {
  classifyHttpStatus,
  classifyPriceBody,
  isAbortError,
} from "./response-mapping.ts";

const PROVIDER = "twelve_data";
const TWELVE_DATA_PRICE_URL = "https://api.twelvedata.com/price";
const FETCH_TIMEOUT_MS = 10000;
const MAX_INSTRUMENTS_PER_RUN = 60;
const RETRY_DELAYS_MS = [250, 500];

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

type SupabaseServiceClient = ReturnType<typeof createClient<Database>>;

async function finalizeRun(
  supabase: SupabaseServiceClient,
  runId: string,
  status: "success" | "partial" | "failed" | "skipped",
  fields: {
    instrumentsRequested?: number;
    instrumentsUpdated?: number;
    instrumentsSkipped?: number;
    errorCode?: string;
  },
): Promise<void> {
  await supabase
    .from("market_data_sync_runs")
    .update({
      status,
      completed_at: new Date().toISOString(),
      instruments_requested: fields.instrumentsRequested ?? 0,
      instruments_updated: fields.instrumentsUpdated ?? 0,
      instruments_skipped: fields.instrumentsSkipped ?? 0,
      error_code: fields.errorCode ?? null,
    })
    .eq("id", runId);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type PriceFetchOutcome =
  | { kind: "ok"; price: string }
  | { kind: "retryable"; code: string }
  | { kind: "permanent"; code: string };

/** One symbol lookup against Twelve Data's /price endpoint, with up to two retries for transient (network/5xx/timeout) failures only — never for an invalid symbol or an auth/permission failure, both of which are permanent for every subsequent call in this run too. The status/body classification itself lives in the pure, directly-tested classifyHttpStatus/classifyPriceBody helpers; a JSON parse failure is its own permanent `invalid_json` outcome, distinct from a retryable network/timeout failure. */
async function fetchTwelveDataPrice(
  symbol: string,
  exchange: string | null,
  apiKey: string,
): Promise<PriceFetchOutcome> {
  const url = new URL(TWELVE_DATA_PRICE_URL);
  url.searchParams.set("symbol", symbol);
  if (exchange) {
    url.searchParams.set("exchange", exchange);
  }
  url.searchParams.set("apikey", apiKey);

  let lastOutcome: PriceFetchOutcome = { kind: "retryable", code: "unknown" };

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    if (attempt > 0) {
      await sleep(RETRY_DELAYS_MS[attempt - 1]!);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(url, { signal: controller.signal });
      const statusOutcome = classifyHttpStatus(response.status);
      if (statusOutcome.kind === "permanent") {
        return statusOutcome;
      }
      if (statusOutcome.kind === "retryable") {
        lastOutcome = statusOutcome;
        continue;
      }

      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.includes("application/json")) {
        return { kind: "permanent", code: "invalid_response_format" };
      }

      let body: unknown;
      try {
        body = await response.json();
      } catch {
        return { kind: "permanent", code: "invalid_json" };
      }

      const priceOutcome = classifyPriceBody(body);
      if (priceOutcome.kind !== "ok") {
        return { kind: "permanent", code: priceOutcome.kind };
      }
      return { kind: "ok", price: priceOutcome.price };
    } catch (err) {
      lastOutcome = {
        kind: "retryable",
        code: isAbortError(err) ? "timeout" : "network_error",
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  return lastOutcome;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: "missing_service_credentials" }, 500);
  }
  const supabase = createClient<Database>(supabaseUrl, serviceRoleKey);

  let instrumentIds: string[] = [];
  try {
    const body: unknown = await req.json();
    if (
      typeof body === "object" &&
      body !== null &&
      "instrument_ids" in body &&
      Array.isArray((body as { instrument_ids: unknown }).instrument_ids)
    ) {
      instrumentIds = (body as { instrument_ids: unknown[] }).instrument_ids
        .filter((id): id is string => typeof id === "string")
        .slice(0, MAX_INSTRUMENTS_PER_RUN);
    }
  } catch {
    return jsonResponse({ error: "invalid_request_body" }, 400);
  }

  const { data: run, error: runError } = await supabase
    .from("market_data_sync_runs")
    .insert({
      provider: PROVIDER,
      scope: "stock_price_refresh",
      status: "running",
      instruments_requested: instrumentIds.length,
    })
    .select("id")
    .single();

  if (runError || !run) {
    return jsonResponse({ error: "could_not_start_run" }, 500);
  }

  const apiKey = Deno.env.get("TWELVE_DATA_API_KEY");
  if (!apiKey) {
    await finalizeRun(supabase, run.id, "skipped", {
      instrumentsRequested: instrumentIds.length,
      errorCode: "provider_not_configured",
    });
    await recordProviderAttempt(
      supabase,
      PROVIDER,
      false,
      "provider_not_configured",
    );
    return jsonResponse(
      { status: "skipped", reason: "provider_not_configured" },
      200,
    );
  }

  if (instrumentIds.length === 0) {
    await finalizeRun(supabase, run.id, "skipped", {
      errorCode: "no_instruments",
    });
    return jsonResponse({ status: "skipped", reason: "no_instruments" }, 200);
  }

  let updated = 0;
  let skipped = 0;
  let authFailed = false;

  for (const instrumentId of instrumentIds) {
    if (authFailed) {
      skipped += 1;
      continue;
    }

    const { data: instrument } = await supabase
      .from("market_instruments")
      .select("id, symbol, exchange")
      .eq("id", instrumentId)
      .eq("provider", PROVIDER)
      .maybeSingle();

    if (!instrument || !instrument.symbol) {
      skipped += 1;
      continue;
    }

    const outcome = await fetchTwelveDataPrice(
      instrument.symbol,
      instrument.exchange,
      apiKey,
    );

    if (outcome.kind === "ok") {
      const { error: priceError } = await supabase.rpc(
        "ingest_market_price_observation",
        {
          p_instrument_id: instrument.id,
          p_provider: PROVIDER,
          p_price_kind: "latest",
          p_effective_date: new Date().toISOString().slice(0, 10),
          p_price: outcome.price,
          p_currency: "INR",
        },
      );
      if (priceError) {
        skipped += 1;
      } else {
        updated += 1;
        await supabase
          .from("market_instruments")
          .update({ last_successful_refresh_at: new Date().toISOString() })
          .eq("id", instrument.id);
      }
    } else {
      skipped += 1;
      if (outcome.code === "provider_auth_failed") {
        authFailed = true;
      }
    }
  }

  const status: "success" | "partial" | "failed" = authFailed
    ? "failed"
    : updated === 0
      ? "failed"
      : skipped > 0
        ? "partial"
        : "success";

  await finalizeRun(supabase, run.id, status, {
    instrumentsRequested: instrumentIds.length,
    instrumentsUpdated: updated,
    instrumentsSkipped: skipped,
    errorCode: authFailed ? "provider_auth_failed" : undefined,
  });

  await recordProviderAttempt(
    supabase,
    PROVIDER,
    updated > 0,
    authFailed ? "provider_auth_failed" : "stock_refresh_failed",
  );

  return jsonResponse({ status, updated, skipped }, 200);
});
