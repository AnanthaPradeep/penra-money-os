// Deno Edge Function — refreshes dividend and stock-split corporate
// events from a configured provider (Twelve Data:
// https://twelvedata.com/docs, corporate-actions endpoint family), mirroring
// ../company-fundamentals-refresh/index.ts's structure and honesty
// discipline exactly.
//
// IMPORTANT — provider state honesty (Phase 10 spec sections 3/15/22): no
// TWELVE_DATA_API_KEY secret exists in this environment as of this
// writing, and the SQL-side gate (public.process_corporate_events_refresh_all,
// see the Phase 10 migration section 15) already checks
// market_data_provider_state.is_configured for 'twelve_data' BEFORE ever
// dispatching here — so in practice this function is never invoked today.
// The not-configured check below is still performed independently
// (defense-in-depth, matching company-fundamentals-refresh's own
// belt-and-suspenders re-check) and is the path that actually runs if it
// ever is invoked without a key. The credentialed path beneath it targets
// Twelve Data's /dividends and /splits endpoints as best understood from
// general familiarity with the provider's documented API family — this
// was NOT independently re-verified against live documentation this
// session, which is a narrower confidence basis than
// company-fundamentals-refresh's mapping (see ./response-mapping.ts's file
// header). This must never be reported as tested, verified, or live until
// a key is configured and the mapping is checked against a real response.
//
// Scope: only dividends and splits are implemented — the spec's other
// corporate-event types (board meetings, results dates, bonus/rights
// issues, buybacks, mergers, management changes, credit ratings,
// insider-trading disclosures, regulatory actions) have no identified
// Twelve-Data-documented endpoint and are not fabricated here. Every
// event this function ingests is written through
// public.ingest_corporate_event, which supersedes/idempotently no-ops
// exactly like ingest_market_price_observation (see the Phase 10
// migration section 13) — a corporate event can also always be entered
// with full manual provenance elsewhere, per the app's own "add IPO
// document" pattern; there is no equivalent user-facing "add a corporate
// event" action because outcome #6 only describes viewing them (see the
// Phase 10 migration section 6's comment).
//
// Invoked the same way as the other market-data functions: by pg_cron via
// public.process_corporate_events_refresh_all -> public.invoke_market_data_function
// -> pg_net. Never called directly by a browser.
import { createClient } from "npm:@supabase/supabase-js@2";

import type { Database } from "../_shared/database.types.ts";
import { recordProviderAttempt } from "../_shared/provider-state.ts";
import {
  classifyErrorEnvelope,
  classifyHttpStatus,
  extractDividendRows,
  extractSplitRows,
  isAbortError,
  isRecord,
} from "./response-mapping.ts";

const PROVIDER = "twelve_data";
const TWELVE_DATA_BASE_URL = "https://api.twelvedata.com";
const FETCH_TIMEOUT_MS = 10000;
const MAX_INSTRUMENTS_PER_RUN = 20;
const RETRY_DELAYS_MS = [250, 500];

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

type SupabaseServiceClient = ReturnType<typeof createClient<Database>>;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function finalizeRun(
  supabase: SupabaseServiceClient,
  runId: string,
  status: "success" | "partial" | "failed" | "skipped",
  fields: {
    itemsRequested?: number;
    itemsUpdated?: number;
    itemsSkipped?: number;
    errorCode?: string;
  },
): Promise<void> {
  await supabase
    .from("research_sync_runs")
    .update({
      status,
      completed_at: new Date().toISOString(),
      items_requested: fields.itemsRequested ?? 0,
      items_updated: fields.itemsUpdated ?? 0,
      items_skipped: fields.itemsSkipped ?? 0,
      error_code: fields.errorCode ?? null,
    })
    .eq("id", runId);
}

type FetchOutcome =
  | { kind: "ok"; body: unknown }
  | { kind: "retryable"; code: string }
  | { kind: "permanent"; code: string };

async function fetchTwelveDataJson(
  path: string,
  params: Record<string, string>,
  apiKey: string,
): Promise<FetchOutcome> {
  const url = new URL(`${TWELVE_DATA_BASE_URL}${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  url.searchParams.set("apikey", apiKey);

  let lastOutcome: FetchOutcome = { kind: "retryable", code: "unknown" };

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

      if (isRecord(body)) {
        const errorCode = classifyErrorEnvelope(body);
        if (errorCode !== null) {
          return { kind: "permanent", code: errorCode };
        }
      }

      return { kind: "ok", body };
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

type InstrumentContext = {
  id: string;
  symbol: string;
  exchange: string | null;
};

type RefreshOutcome = "updated" | "skipped" | "auth_failed";

async function refreshDividends(
  supabase: SupabaseServiceClient,
  instrument: InstrumentContext,
  apiKey: string,
): Promise<RefreshOutcome> {
  const outcome = await fetchTwelveDataJson(
    "/dividends",
    {
      symbol: instrument.symbol,
      ...(instrument.exchange ? { exchange: instrument.exchange } : {}),
    },
    apiKey,
  );
  if (outcome.kind !== "ok") {
    return outcome.code === "provider_auth_failed" ? "auth_failed" : "skipped";
  }

  const rows = extractDividendRows(outcome.body, instrument.symbol);
  if (rows.length === 0) {
    return "skipped";
  }

  let anyUpdated = false;
  for (const row of rows) {
    const { error } = await supabase.rpc("ingest_corporate_event", {
      p_instrument_id: instrument.id,
      p_event_type: "dividend",
      p_title: `Dividend — ex-date ${row.exDate}`,
      p_source: PROVIDER,
      p_ex_date: row.exDate,
      p_details: { amount_per_share: row.amountPerShare },
      p_provider_event_id: row.providerEventId,
    });
    if (!error) {
      anyUpdated = true;
    }
  }
  return anyUpdated ? "updated" : "skipped";
}

async function refreshSplits(
  supabase: SupabaseServiceClient,
  instrument: InstrumentContext,
  apiKey: string,
): Promise<RefreshOutcome> {
  const outcome = await fetchTwelveDataJson(
    "/splits",
    {
      symbol: instrument.symbol,
      ...(instrument.exchange ? { exchange: instrument.exchange } : {}),
    },
    apiKey,
  );
  if (outcome.kind !== "ok") {
    return outcome.code === "provider_auth_failed" ? "auth_failed" : "skipped";
  }

  const rows = extractSplitRows(outcome.body, instrument.symbol);
  if (rows.length === 0) {
    return "skipped";
  }

  let anyUpdated = false;
  for (const row of rows) {
    const { error } = await supabase.rpc("ingest_corporate_event", {
      p_instrument_id: instrument.id,
      p_event_type: "stock_split",
      p_title: `Stock split — ${row.fromFactor}:${row.toFactor}`,
      p_source: PROVIDER,
      p_effective_date: row.effectiveDate,
      p_details: { from_factor: row.fromFactor, to_factor: row.toFactor },
      p_provider_event_id: row.providerEventId,
    });
    if (!error) {
      anyUpdated = true;
    }
  }
  return anyUpdated ? "updated" : "skipped";
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
    if (isRecord(body) && Array.isArray(body["instrument_ids"])) {
      instrumentIds = body["instrument_ids"]
        .filter((id): id is string => typeof id === "string")
        .slice(0, MAX_INSTRUMENTS_PER_RUN);
    }
  } catch {
    return jsonResponse({ error: "invalid_request_body" }, 400);
  }

  const { data: run, error: runError } = await supabase
    .from("research_sync_runs")
    .insert({
      scope: "corporate_events_refresh",
      status: "running",
      items_requested: instrumentIds.length,
    })
    .select("id")
    .single();

  if (runError || !run) {
    return jsonResponse({ error: "could_not_start_run" }, 500);
  }

  const apiKey = Deno.env.get("TWELVE_DATA_API_KEY");
  if (!apiKey) {
    await finalizeRun(supabase, run.id, "skipped", {
      itemsRequested: instrumentIds.length,
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

    const { data: instrumentRow } = await supabase
      .from("market_instruments")
      .select("id, symbol, exchange, instrument_kind")
      .eq("id", instrumentId)
      .eq("instrument_kind", "stock")
      .maybeSingle();

    if (!instrumentRow || !instrumentRow.symbol) {
      skipped += 1;
      continue;
    }

    const instrument: InstrumentContext = {
      id: instrumentRow.id,
      symbol: instrumentRow.symbol,
      exchange: instrumentRow.exchange,
    };

    const outcomes: RefreshOutcome[] = [];
    outcomes.push(await refreshDividends(supabase, instrument, apiKey));
    if (outcomes.at(-1) !== "auth_failed") {
      outcomes.push(await refreshSplits(supabase, instrument, apiKey));
    }

    if (outcomes.includes("auth_failed")) {
      authFailed = true;
      skipped += 1;
    } else if (outcomes.includes("updated")) {
      updated += 1;
    } else {
      skipped += 1;
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
    itemsRequested: instrumentIds.length,
    itemsUpdated: updated,
    itemsSkipped: skipped,
    errorCode: authFailed ? "provider_auth_failed" : undefined,
  });

  await recordProviderAttempt(
    supabase,
    PROVIDER,
    updated > 0,
    authFailed ? "provider_auth_failed" : "corporate_events_refresh_failed",
  );

  return jsonResponse({ status, updated, skipped }, 200);
});
