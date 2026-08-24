/**
 * Pure response-classification and field-mapping logic for
 * company-fundamentals-refresh, split out of ./index.ts exactly the way
 * ../amfi-nav-refresh/parser.ts is split out of that function's index.ts:
 * no Deno global, no `npm:` import, no network call — so this file runs
 * unmodified under both the deployed Deno Edge Function and Vitest
 * (./response-mapping.test.ts), and tsconfig.json's exclude list (which
 * only excludes `supabase/functions/**\/index.ts` and
 * `supabase/functions/_shared/**`) leaves it fully type-checked and
 * lint-checked like any other first-party file.
 *
 * See index.ts's file header for the load-bearing caveat this file
 * inherits: the exact field-path candidates below are best-effort against
 * Twelve Data's public documentation and have never been verified against
 * a live response in this environment.
 */

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Classifies an HTTP status code from Twelve Data into what the caller should do next — a pure decision table with no I/O, so every branch is directly testable without a real network call. */
export type HttpStatusOutcome =
  | { kind: "ok" }
  | { kind: "permanent"; code: "provider_auth_failed" }
  | { kind: "retryable"; code: "rate_limited" }
  | { kind: "retryable"; code: "upstream_error" }
  | { kind: "permanent"; code: string };

export function classifyHttpStatus(status: number): HttpStatusOutcome {
  if (status === 401 || status === 403) {
    return { kind: "permanent", code: "provider_auth_failed" };
  }
  if (status === 429) {
    return { kind: "retryable", code: "rate_limited" };
  }
  if (status >= 500) {
    return { kind: "retryable", code: "upstream_error" };
  }
  if (status < 200 || status >= 300) {
    return { kind: "permanent", code: `upstream_http_${status}` };
  }
  return { kind: "ok" };
}

/** Twelve Data returns HTTP 200 with a JSON error envelope (rather than a non-2xx status) for both invalid symbols and plan-restricted endpoints — this distinguishes the two from the envelope's message text, since only the latter is worth ever recording distinctly from a permanent symbol error (never automatically retried under a different plan). Returns null when `body` isn't such an envelope at all. */
export function classifyErrorEnvelope(
  body: Record<string, unknown>,
): string | null {
  if (body["status"] !== "error") {
    return null;
  }
  const message =
    typeof body["message"] === "string" ? body["message"].toLowerCase() : "";
  if (message.includes("plan") || message.includes("subscribe")) {
    return "plan_restricted";
  }
  if (message.includes("symbol") || message.includes("not found")) {
    return "invalid_symbol";
  }
  return "provider_error";
}

/** True for a caught fetch error that represents a timeout (AbortController firing), false for any other network failure. Both are retryable, but recorded under distinct codes for observability. */
export function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === "AbortError";
}

function getPath(obj: unknown, path: readonly string[]): unknown {
  let current: unknown = obj;
  for (const key of path) {
    if (!isRecord(current)) {
      return undefined;
    }
    current = current[key];
  }
  return current;
}

/** Tries each candidate path in order and returns the first one that resolves to a finite number (or a numeric string, which Twelve Data sometimes returns). Multiple candidates exist because the exact nesting of Twelve Data's fundamentals responses is unverified in this environment — see the file header. Never coerces a missing/non-numeric value to 0. */
export function pickNumber(
  obj: unknown,
  candidatePaths: readonly (readonly string[])[],
): number | null {
  for (const path of candidatePaths) {
    const raw = getPath(obj, path);
    if (typeof raw === "number" && Number.isFinite(raw)) {
      return raw;
    }
    if (typeof raw === "string" && raw.trim().length > 0) {
      const parsed = Number(raw);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return null;
}

export function pickString(
  obj: unknown,
  candidatePaths: readonly (readonly string[])[],
): string | null {
  for (const path of candidatePaths) {
    const raw = getPath(obj, path);
    if (typeof raw === "string" && raw.trim().length > 0) {
      return raw.trim();
    }
  }
  return null;
}

/** Derives a 1-4 fiscal quarter number from a fiscal period-end date's calendar month. This is a simplifying assumption (calendar-quarter alignment) — a company with a non-calendar fiscal year would get a technically-mislabeled quarter number under this scheme; Twelve Data does not appear to publish an explicit quarter-number field in its documented response shape, so this is the best available derivation absent that field. Returns null for an unparseable month. */
export function deriveFiscalQuarter(fiscalDate: string): number | null {
  const month = Number(fiscalDate.slice(5, 7));
  if (!Number.isFinite(month) || month < 1 || month > 12) {
    return null;
  }
  return Math.min(4, Math.max(1, Math.ceil(month / 3)));
}

export const FISCAL_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// ---------------------------------------------------------------------
// Field maps: provider path candidates -> our fixed metric_key vocabulary
// (see company_financial_metrics_metric_key_valid in the Phase 9
// migration). Deliberately omits total_debt and free_cash_flow — those
// are derived figures our own client-side ratio calculator computes from
// the components below; ingesting a silently-computed value under a
// provider-sourced metric key would misrepresent it as a provider fact.
// ---------------------------------------------------------------------

export type FieldMap = readonly [string, readonly (readonly string[])[]][];

export const INCOME_STATEMENT_FIELDS: FieldMap = [
  ["revenue", [["sales"], ["revenue"]]],
  ["cost_of_revenue", [["cost_of_goods"], ["cost_of_revenue"]]],
  ["gross_profit", [["gross_profit"]]],
  ["operating_expenses", [["operating_expense"], ["operating_expenses"]]],
  ["operating_income", [["operating_income"]]],
  ["ebitda", [["ebitda"]]],
  [
    "interest_expense",
    [["non_operating_interest", "expense"], ["interest_expense"]],
  ],
  ["profit_before_tax", [["pretax_income"], ["income_before_tax"]]],
  ["tax_expense", [["income_tax"], ["tax_provision"]]],
  ["net_income", [["net_income"]]],
  ["eps_basic", [["eps_basic"], ["basic_eps"]]],
  ["eps_diluted", [["eps_diluted"], ["diluted_eps"]]],
  [
    "shares_outstanding",
    [["basic_shares_outstanding"], ["shares_outstanding"]],
  ],
];

export const BALANCE_SHEET_FIELDS: FieldMap = [
  [
    "cash_and_equivalents",
    [
      ["assets", "current_assets", "cash_and_equivalents"],
      ["assets", "current_assets", "cash"],
    ],
  ],
  ["current_assets", [["assets", "current_assets", "total_current_assets"]]],
  ["total_assets", [["assets", "total_assets"]]],
  [
    "current_liabilities",
    [["liabilities", "current_liabilities", "total_current_liabilities"]],
  ],
  ["total_liabilities", [["liabilities", "total_liabilities"]]],
  [
    "short_term_debt",
    [["liabilities", "current_liabilities", "short_term_debt"]],
  ],
  [
    "long_term_debt",
    [["liabilities", "non_current_liabilities", "long_term_debt"]],
  ],
  [
    "shareholder_equity",
    [["shareholders_equity", "total_shareholders_equity"]],
  ],
  ["retained_earnings", [["shareholders_equity", "retained_earnings"]]],
];

export const CASH_FLOW_FIELDS: FieldMap = [
  ["operating_cash_flow", [["operating_activities", "operating_cash_flow"]]],
  ["capital_expenditure", [["investing_activities", "capital_expenditures"]]],
  ["investing_cash_flow", [["investing_activities", "investing_cash_flow"]]],
  ["financing_cash_flow", [["financing_activities", "financing_cash_flow"]]],
  ["dividends_paid", [["financing_activities", "cash_dividends_paid"]]],
  ["debt_issuance", [["financing_activities", "issuance_of_debt"]]],
  ["debt_repayment", [["financing_activities", "repayment_of_debt"]]],
];

export const RATIO_FIELDS: FieldMap = [
  [
    "pe_ratio",
    [
      ["statistics", "valuations_metrics", "trailing_pe"],
      ["statistics", "valuations_metrics", "pe_ratio"],
    ],
  ],
  ["pb_ratio", [["statistics", "valuations_metrics", "price_to_book_mrq"]]],
  ["ps_ratio", [["statistics", "valuations_metrics", "price_to_sales_ttm"]]],
  [
    "dividend_yield",
    [["statistics", "dividends_and_splits", "forward_annual_dividend_yield"]],
  ],
];

export type MetricRow = {
  period_id: string;
  statement_type: "income_statement" | "balance_sheet" | "cash_flow" | "ratio";
  metric_key: string;
  value: number;
  unit_scale: string;
  provider: string;
};

/** Extracts every metric this statement's field map can find in `periodObject`, skipping (never zero-filling) any field whose path doesn't resolve to a finite number. */
export function extractMetricRows(
  periodObject: unknown,
  periodId: string,
  statementType: "income_statement" | "balance_sheet" | "cash_flow",
  fields: FieldMap,
  provider: string,
): MetricRow[] {
  const rows: MetricRow[] = [];
  for (const [metricKey, paths] of fields) {
    const value = pickNumber(periodObject, paths);
    if (value === null) {
      continue;
    }
    rows.push({
      period_id: periodId,
      statement_type: statementType,
      metric_key: metricKey,
      value,
      unit_scale: "unit",
      provider,
    });
  }
  return rows;
}
