// Deno Edge Function — fetches AMFI's official public NAVAll.txt feed,
// parses it (see ./parser.ts), and ingests every valid scheme/NAV pair as a
// market_instruments + market_prices row using the function's own
// auto-injected SUPABASE_SERVICE_ROLE_KEY (bypasses RLS by design — this is
// the one trusted, server-only write path for AMFI data). Invoked either by
// pg_cron (via public.run_amfi_refresh -> pg_net) on a schedule, or
// indirectly by a user's self-scoped refresh request
// (public.run_market_data_refresh_self). Never invoked directly by a
// browser — verify_jwt requires a valid project JWT, and no client role is
// ever granted execute on the SQL wrappers that call this.
//
// AMFI's daily file lists ~14,000 schemes. Ingestion is done in a handful
// of bulk round trips (batched upsert + a batched server-side RPC loop),
// not one HTTP request per scheme — a per-row loop over 14,000 rows would
// run for many minutes and risk running past pg_net's response-tracking
// window in invoke_market_data_function.
import { createClient } from "npm:@supabase/supabase-js@2";

import type { Database } from "../_shared/database.types.ts";
import { recordProviderAttempt } from "../_shared/provider-state.ts";
import {
  looksLikeAmfiNavContent,
  parseAmfiNavAll,
  type ParsedAmfiRow,
} from "./parser.ts";

const AMFI_NAV_URL = "https://www.amfiindia.com/spages/NAVAll.txt";
const FETCH_TIMEOUT_MS = 20000;
const PROVIDER = "amfi";
const BATCH_SIZE = 2000;

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
  status: "success" | "partial" | "failed",
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

/** AMFI's own Plan/Option text, appended verbatim — never guessed from the base scheme name (see parser.ts's doc comment on why Plan/Option are kept as their own columns). Either may legitimately be blank for a handful of schemes. */
function buildInstrumentName(row: ParsedAmfiRow): string {
  return [row.schemeName, row.plan, row.option]
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .join(" - ");
}

function chunk<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

/**
 * Bulk-upserts every parsed scheme as a market_instruments row and returns
 * a scheme-code -> instrument-id map for the rows that succeeded. Two
 * different scheme codes sharing the same ISIN (AMFI data is expected to
 * avoid this, but it isn't parser-validated — see parser.ts's own,
 * deliberately narrower scope) would collide with the
 * `(provider, upper(isin)) where isin is not null` unique index and abort
 * an entire batch; the second and later scheme to claim an already-seen
 * ISIN in this run has its ISIN dropped (set to null) before upserting, so
 * one AMC's data-entry mistake can never take down the whole day's refresh.
 */
async function upsertInstruments(
  supabase: SupabaseServiceClient,
  rows: readonly ParsedAmfiRow[],
): Promise<Map<string, string>> {
  const seenIsins = new Set<string>();
  const payload = rows.map((row) => {
    const isin = row.isinGrowth ?? row.isinReinvestment;
    const dedupedIsin =
      isin !== null && !seenIsins.has(isin.toUpperCase()) ? isin : null;
    if (dedupedIsin !== null) {
      seenIsins.add(dedupedIsin.toUpperCase());
    }
    return {
      provider: PROVIDER,
      provider_instrument_id: row.schemeCode,
      instrument_kind: "mutual_fund",
      name: buildInstrumentName(row),
      isin: dedupedIsin,
      quote_currency: "INR",
      timezone: "Asia/Kolkata",
      is_active: true,
      last_successful_refresh_at: new Date().toISOString(),
    };
  });

  const schemeCodeToInstrumentId = new Map<string, string>();

  for (const batch of chunk(payload, BATCH_SIZE)) {
    const { data, error } = await supabase
      .from("market_instruments")
      .upsert(batch, { onConflict: "provider,provider_instrument_id" })
      .select("id, provider_instrument_id");

    if (error || !data) {
      continue;
    }
    for (const instrument of data) {
      schemeCodeToInstrumentId.set(
        instrument.provider_instrument_id,
        instrument.id,
      );
    }
  }

  return schemeCodeToInstrumentId;
}

/** Ingests every row's NAV via the batched, correction-aware RPC — see ingest_market_price_observations_batch. Rows whose instrument failed to upsert (not present in `schemeCodeToInstrumentId`) are counted as skipped without a network call. */
async function ingestPrices(
  supabase: SupabaseServiceClient,
  rows: readonly ParsedAmfiRow[],
  schemeCodeToInstrumentId: ReadonlyMap<string, string>,
): Promise<{ updated: number; skipped: number }> {
  const priceRows = rows
    .map((row) => {
      const instrumentId = schemeCodeToInstrumentId.get(row.schemeCode);
      return instrumentId
        ? {
            instrument_id: instrumentId,
            effective_date: row.navDate,
            price: row.nav,
          }
        : null;
    })
    .filter(
      (
        r,
      ): r is {
        instrument_id: string;
        effective_date: string;
        price: string;
      } => r !== null,
    );

  let updated = 0;
  let skipped = rows.length - priceRows.length;

  for (const batch of chunk(priceRows, BATCH_SIZE)) {
    const { data, error } = await supabase
      .rpc("ingest_market_price_observations_batch", {
        p_provider: PROVIDER,
        p_price_kind: "nav",
        p_currency: "INR",
        p_rows: batch,
      })
      .single();

    if (error || !data) {
      skipped += batch.length;
      continue;
    }
    updated += data.updated_count;
    skipped += data.skipped_count;
  }

  return { updated, skipped };
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

  const { data: run, error: runError } = await supabase
    .from("market_data_sync_runs")
    .insert({ provider: PROVIDER, scope: "nav_refresh", status: "running" })
    .select("id")
    .single();

  if (runError || !run) {
    return jsonResponse({ error: "could_not_start_run" }, 500);
  }

  let content: string;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(AMFI_NAV_URL, {
        signal: controller.signal,
        headers: { Accept: "text/plain" },
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      await finalizeRun(supabase, run.id, "failed", {
        errorCode: `upstream_http_${response.status}`,
      });
      return jsonResponse({ error: "upstream_non_200" }, 502);
    }
    content = await response.text();
  } catch (err) {
    const isAbort = err instanceof Error && err.name === "AbortError";
    await finalizeRun(supabase, run.id, "failed", {
      errorCode: isAbort ? "timeout" : "network_error",
    });
    return jsonResponse({ error: isAbort ? "timeout" : "network_error" }, 502);
  }

  if (!looksLikeAmfiNavContent(content)) {
    await finalizeRun(supabase, run.id, "failed", {
      errorCode: "unexpected_content",
    });
    return jsonResponse({ error: "unexpected_content" }, 502);
  }

  const { rows, issues } = parseAmfiNavAll(content);

  const schemeCodeToInstrumentId = await upsertInstruments(supabase, rows);
  const { updated, skipped: priceSkipped } = await ingestPrices(
    supabase,
    rows,
    schemeCodeToInstrumentId,
  );
  const skipped = issues.length + priceSkipped;

  const status: "success" | "partial" | "failed" =
    updated === 0
      ? "failed"
      : issues.length + priceSkipped > 0
        ? "partial"
        : "success";

  await finalizeRun(supabase, run.id, status, {
    instrumentsRequested: rows.length,
    instrumentsUpdated: updated,
    instrumentsSkipped: skipped,
  });

  await recordProviderAttempt(
    supabase,
    PROVIDER,
    updated > 0,
    "amfi_ingest_failed",
  );

  return jsonResponse(
    { status, updated, skipped, totalParsed: rows.length },
    200,
  );
});
