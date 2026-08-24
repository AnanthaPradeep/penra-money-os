/**
 * Pure response-classification logic for stock-price-refresh, split out of
 * ./index.ts the same way ../amfi-nav-refresh/parser.ts is split out of
 * that function's index.ts: no Deno global, no `npm:` import, no network
 * call — runs unmodified under both the deployed Deno Edge Function and
 * Vitest (./response-mapping.test.ts), and stays fully type-checked and
 * lint-checked (tsconfig.json's exclude list only excludes
 * `supabase/functions/**\/index.ts` and `supabase/functions/_shared/**`).
 */

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export type HttpStatusOutcome =
  | { kind: "ok" }
  | { kind: "permanent"; code: "provider_auth_failed" }
  | { kind: "retryable"; code: "rate_limited" }
  | { kind: "retryable"; code: "upstream_error" }
  | { kind: "permanent"; code: string };

/** Classifies an HTTP status code from Twelve Data into what the caller should do next — a pure decision table with no I/O, directly testable without a real network call. Identical decision table to company-fundamentals-refresh's copy; kept as a separate file rather than a `_shared/` import because `_shared/**` is deliberately excluded from tsconfig/type-aware lint (see that directory's own files), and this table is simple enough that duplicating it costs less than losing type-checking on it. */
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

export function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === "AbortError";
}

const PRICE_PATTERN = /^\d+(\.\d+)?$/;

export type PriceBodyOutcome =
  | { kind: "ok"; price: string }
  | { kind: "invalid_symbol" }
  | { kind: "invalid_response_shape" }
  | { kind: "invalid_price_value" };

/** Validates the shape of a parsed Twelve Data /price response body — never coerces a missing/malformed price to 0 or NaN; a non-positive or non-numeric value is rejected outright. */
export function classifyPriceBody(body: unknown): PriceBodyOutcome {
  if (isRecord(body) && "status" in body && body["status"] === "error") {
    return { kind: "invalid_symbol" };
  }

  if (!isRecord(body) || typeof body["price"] !== "string") {
    return { kind: "invalid_response_shape" };
  }

  const priceText = body["price"];
  if (!PRICE_PATTERN.test(priceText) || Number(priceText) <= 0) {
    return { kind: "invalid_price_value" };
  }

  return { kind: "ok", price: priceText };
}
