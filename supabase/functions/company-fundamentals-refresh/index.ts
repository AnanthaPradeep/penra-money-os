// Deno Edge Function — refreshes company profile, annual/quarterly
// financial statements, and provider-supplied ratios from a configured
// fundamentals data provider (Twelve Data:
// https://twelvedata.com/docs#fundamentals-data).
//
// IMPORTANT — provider state honesty (Phase 9 spec section 4/22): no
// TWELVE_DATA_API_KEY secret exists in this environment as of this
// writing. The "not configured" boundary below (checked first, before any
// network call) is the path that actually runs today; it is fully
// implemented, safe to invoke, and records a `skipped` sync run without
// touching any company_profiles/company_financial_periods/
// company_financial_metrics row. The credentialed path beneath it is
// written against Twelve Data's documented fundamentals endpoints and
// field names as best understood from public documentation (see
// ./response-mapping.ts's field maps), but it has NEVER been exercised
// against the live API in this environment. That mapping must be verified
// against a real response the first time a key is configured — until then
// this must never be reported as tested, verified, or live.
//
// Reuses the same 'twelve_data' market_data_provider_state row as
// stock-price-refresh (one provider, two different endpoint families) and
// its own dedicated fundamentals_sync_runs log (separate from
// market_data_sync_runs, which stock-price-refresh/amfi-nav-refresh own).
//
// Invoked the same way as the other two market-data functions: by pg_cron
// via public.process_company_fundamentals_refresh_all ->
// public.run_fundamentals_refresh -> public.invoke_market_data_function ->
// pg_net, or indirectly by a user's self-scoped
// public.run_fundamentals_refresh_self. Never called directly by a
// browser.
import { createClient } from "npm:@supabase/supabase-js@2";

import type { Database } from "../_shared/database.types.ts";
import { recordProviderAttempt } from "../_shared/provider-state.ts";
import {
  BALANCE_SHEET_FIELDS,
  CASH_FLOW_FIELDS,
  classifyErrorEnvelope,
  classifyHttpStatus,
  deriveFiscalQuarter,
  extractMetricRows,
  FISCAL_DATE_PATTERN,
  INCOME_STATEMENT_FIELDS,
  isAbortError,
  isRecord,
  type FieldMap,
  type MetricRow,
  pickNumber,
  pickString,
  RATIO_FIELDS,
} from "./response-mapping.ts";

const PROVIDER = "twelve_data";
const TWELVE_DATA_BASE_URL = "https://api.twelvedata.com";
const FETCH_TIMEOUT_MS = 10000;
// Fundamentals cost far more calls per instrument (profile + 3 statements x
// 2 period types + statistics = 8 requests) than a single price lookup, so
// the per-run instrument cap is much lower than stock-price-refresh's.
const MAX_INSTRUMENTS_PER_RUN = 15;
const MAX_PERIODS_PER_STATEMENT = 8;
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
    instrumentsRequested?: number;
    instrumentsUpdated?: number;
    instrumentsSkipped?: number;
    errorCode?: string;
  },
): Promise<void> {
  await supabase
    .from("fundamentals_sync_runs")
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

type FetchOutcome =
  | { kind: "ok"; body: unknown }
  | { kind: "retryable"; code: string }
  | { kind: "permanent"; code: string };

/** Generic Twelve Data JSON fetch with retry/timeout handling — the retryable-vs-permanent classification itself lives in the pure, directly-tested classifyHttpStatus/classifyErrorEnvelope helpers; this function's own job is purely the I/O loop (timeout, retry delay, JSON parsing) around them. A JSON parse failure is classified as its own permanent `invalid_json` outcome, distinct from a network/timeout retryable failure — a malformed body will not become well-formed on retry. */
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

// ---------------------------------------------------------------------
// Per-instrument orchestration
// ---------------------------------------------------------------------

type InstrumentContext = {
  id: string;
  symbol: string;
  exchange: string | null;
  currency: string;
};

type StatementKind = "income_statement" | "balance_sheet" | "cash_flow";

const STATEMENT_ENDPOINTS: Record<
  StatementKind,
  { path: string; arrayKey: string; fields: FieldMap }
> = {
  income_statement: {
    path: "/income_statement",
    arrayKey: "income_statement",
    fields: INCOME_STATEMENT_FIELDS,
  },
  balance_sheet: {
    path: "/balance_sheet",
    arrayKey: "balance_sheet",
    fields: BALANCE_SHEET_FIELDS,
  },
  cash_flow: {
    path: "/cash_flow",
    arrayKey: "cash_flow",
    fields: CASH_FLOW_FIELDS,
  },
};

type RefreshOutcome = "updated" | "skipped" | "auth_failed";

async function refreshOneStatement(
  supabase: SupabaseServiceClient,
  instrument: InstrumentContext,
  statementKind: StatementKind,
  periodType: "annual" | "quarterly",
  apiKey: string,
): Promise<RefreshOutcome> {
  const endpoint = STATEMENT_ENDPOINTS[statementKind];
  const outcome = await fetchTwelveDataJson(
    endpoint.path,
    {
      symbol: instrument.symbol,
      ...(instrument.exchange ? { exchange: instrument.exchange } : {}),
      period: periodType,
    },
    apiKey,
  );

  if (outcome.kind !== "ok") {
    return outcome.code === "provider_auth_failed" ? "auth_failed" : "skipped";
  }

  const currency =
    pickString(outcome.body, [["meta", "currency"]]) ?? instrument.currency;
  const rawPeriods = isRecord(outcome.body)
    ? outcome.body[endpoint.arrayKey]
    : undefined;
  if (!Array.isArray(rawPeriods)) {
    return "skipped";
  }

  let anyUpdated = false;
  for (const periodObject of rawPeriods.slice(0, MAX_PERIODS_PER_STATEMENT)) {
    const fiscalDate = pickString(periodObject, [["fiscal_date"]]);
    if (fiscalDate === null || !FISCAL_DATE_PATTERN.test(fiscalDate)) {
      continue;
    }
    const fiscalYear = Number(fiscalDate.slice(0, 4));
    const fiscalQuarter =
      periodType === "quarterly" ? deriveFiscalQuarter(fiscalDate) : null;
    if (periodType === "quarterly" && fiscalQuarter === null) {
      continue;
    }

    const { data: periodId, error: periodError } = await supabase.rpc(
      "ensure_company_financial_period",
      {
        p_instrument_id: instrument.id,
        p_period_type: periodType,
        p_fiscal_period_end: fiscalDate,
        p_fiscal_year: fiscalYear,
        p_fiscal_quarter: fiscalQuarter,
        p_report_date: null,
        p_currency: currency,
        p_statement_basis: "consolidated",
        p_provider: PROVIDER,
      },
    );

    if (periodError || !periodId) {
      continue;
    }

    const rows = extractMetricRows(
      periodObject,
      periodId,
      statementKind,
      endpoint.fields,
      PROVIDER,
    );
    if (rows.length === 0) {
      continue;
    }

    const { error: batchError } = await supabase
      .rpc("ingest_company_financial_metrics_batch", { p_rows: rows })
      .single();
    if (!batchError) {
      anyUpdated = true;
    }
  }

  return anyUpdated ? "updated" : "skipped";
}

async function refreshProfile(
  supabase: SupabaseServiceClient,
  instrument: InstrumentContext,
  apiKey: string,
): Promise<RefreshOutcome> {
  const outcome = await fetchTwelveDataJson(
    "/profile",
    {
      symbol: instrument.symbol,
      ...(instrument.exchange ? { exchange: instrument.exchange } : {}),
    },
    apiKey,
  );
  if (outcome.kind !== "ok") {
    return outcome.code === "provider_auth_failed" ? "auth_failed" : "skipped";
  }

  const legalName = pickString(outcome.body, [["name"]]);
  const sector = pickString(outcome.body, [["sector"]]);
  const industry = pickString(outcome.body, [["industry"]]);
  const country = pickString(outcome.body, [["country"]]);
  const website = pickString(outcome.body, [["website"]]);
  const description = pickString(outcome.body, [["description"]]);

  const { error } = await supabase.rpc("ingest_company_profile", {
    p_instrument_id: instrument.id,
    p_provider: PROVIDER,
    p_legal_name: legalName,
    p_country: country,
    p_sector: sector,
    p_industry: industry,
    p_fiscal_year_end: null,
    p_website: website,
    p_description: description,
  });

  return error ? "skipped" : "updated";
}

async function refreshRatios(
  supabase: SupabaseServiceClient,
  instrument: InstrumentContext,
  apiKey: string,
): Promise<RefreshOutcome> {
  const outcome = await fetchTwelveDataJson(
    "/statistics",
    {
      symbol: instrument.symbol,
      ...(instrument.exchange ? { exchange: instrument.exchange } : {}),
    },
    apiKey,
  );
  if (outcome.kind !== "ok") {
    return outcome.code === "provider_auth_failed" ? "auth_failed" : "skipped";
  }

  const values: { metricKey: string; value: number }[] = [];
  for (const [metricKey, paths] of RATIO_FIELDS) {
    const value = pickNumber(outcome.body, paths);
    if (value !== null) {
      values.push({ metricKey, value });
    }
  }
  if (values.length === 0) {
    return "skipped";
  }

  // Provider-supplied ratios are stored against a synthetic "as-of-today"
  // annual-basis period keyed to the current date, since Twelve Data's
  // /statistics response is a live snapshot rather than tied to a
  // specific fiscal period end the way the three statements are.
  const asOfDate = new Date().toISOString().slice(0, 10);
  const { data: periodId, error: periodError } = await supabase.rpc(
    "ensure_company_financial_period",
    {
      p_instrument_id: instrument.id,
      p_period_type: "annual",
      p_fiscal_period_end: asOfDate,
      p_fiscal_year: Number(asOfDate.slice(0, 4)),
      p_fiscal_quarter: null,
      p_report_date: asOfDate,
      p_currency: instrument.currency,
      p_statement_basis: "consolidated",
      p_provider: PROVIDER,
    },
  );
  if (periodError || !periodId) {
    return "skipped";
  }

  const rows: MetricRow[] = values.map(({ metricKey, value }) => ({
    period_id: periodId,
    statement_type: "ratio",
    metric_key: metricKey,
    value,
    unit_scale: "unit",
    provider: PROVIDER,
  }));

  const { error: batchError } = await supabase
    .rpc("ingest_company_financial_metrics_batch", { p_rows: rows })
    .single();

  return batchError ? "skipped" : "updated";
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
    .from("fundamentals_sync_runs")
    .insert({
      provider: PROVIDER,
      scope: "company_fundamentals_refresh",
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

    const { data: instrumentRow } = await supabase
      .from("market_instruments")
      .select("id, symbol, exchange, quote_currency, instrument_kind")
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
      currency: instrumentRow.quote_currency,
    };

    const outcomes: RefreshOutcome[] = [];
    outcomes.push(await refreshProfile(supabase, instrument, apiKey));
    if (outcomes.at(-1) !== "auth_failed") {
      for (const statementKind of Object.keys(
        STATEMENT_ENDPOINTS,
      ) as StatementKind[]) {
        for (const periodType of ["annual", "quarterly"] as const) {
          if (outcomes.at(-1) === "auth_failed") {
            break;
          }
          outcomes.push(
            await refreshOneStatement(
              supabase,
              instrument,
              statementKind,
              periodType,
              apiKey,
            ),
          );
        }
      }
    }
    if (outcomes.at(-1) !== "auth_failed") {
      outcomes.push(await refreshRatios(supabase, instrument, apiKey));
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
    instrumentsRequested: instrumentIds.length,
    instrumentsUpdated: updated,
    instrumentsSkipped: skipped,
    errorCode: authFailed ? "provider_auth_failed" : undefined,
  });

  await recordProviderAttempt(
    supabase,
    PROVIDER,
    updated > 0,
    authFailed ? "provider_auth_failed" : "fundamentals_refresh_failed",
  );

  return jsonResponse({ status, updated, skipped }, 200);
});
