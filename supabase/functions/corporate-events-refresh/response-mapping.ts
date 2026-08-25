/**
 * Pure response-classification and field-mapping logic for
 * corporate-events-refresh, structured identically to
 * ../company-fundamentals-refresh/response-mapping.ts: no Deno global, no
 * `npm:` import, no network call — runs unmodified under both the
 * deployed Deno Edge Function and Vitest (./response-mapping.test.ts).
 *
 * IMPORTANT — honesty note (see index.ts's file header): the field-path
 * candidates below for Twelve Data's /dividends and /splits endpoints are
 * best-effort against public documentation and have NEVER been verified
 * against a live response in this environment, exactly like the
 * fundamentals mapping this file mirrors. Unlike that file, this one has
 * an even narrower confidence basis — Twelve Data's dividends/splits
 * response shape was not independently re-verified this session, only
 * recalled from general familiarity with the provider's documented API
 * family. Treat every field name here as a best guess until it is
 * confirmed against a real response the first time a key is configured.
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

/** Twelve Data returns HTTP 200 with a JSON error envelope for both invalid symbols and plan-restricted endpoints — mirrors company-fundamentals-refresh's identical classification. */
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

export const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export type DividendRow = {
  exDate: string;
  amountPerShare: number;
  providerEventId: string;
};

/** Extracts every well-formed dividend entry from a /dividends-shaped response. Skips (never zero-fills) an entry missing a valid ex_date or a finite amount. */
export function extractDividendRows(
  body: unknown,
  symbol: string,
): DividendRow[] {
  const rawList = isRecord(body) ? body["dividends"] : undefined;
  if (!Array.isArray(rawList)) {
    return [];
  }
  const rows: DividendRow[] = [];
  for (const entry of rawList) {
    const exDate = pickString(entry, [["ex_date"], ["date"]]);
    const amount = pickNumber(entry, [["amount"], ["dividend"]]);
    if (exDate === null || !ISO_DATE_PATTERN.test(exDate) || amount === null) {
      continue;
    }
    rows.push({
      exDate,
      amountPerShare: amount,
      providerEventId: `dividend-${symbol}-${exDate}`,
    });
  }
  return rows;
}

export type SplitRow = {
  effectiveDate: string;
  fromFactor: number;
  toFactor: number;
  providerEventId: string;
};

/** Extracts every well-formed split entry from a /splits-shaped response. */
export function extractSplitRows(body: unknown, symbol: string): SplitRow[] {
  const rawList = isRecord(body) ? body["splits"] : undefined;
  if (!Array.isArray(rawList)) {
    return [];
  }
  const rows: SplitRow[] = [];
  for (const entry of rawList) {
    const effectiveDate = pickString(entry, [["date"], ["split_date"]]);
    const fromFactor = pickNumber(entry, [["from_factor"]]);
    const toFactor = pickNumber(entry, [["to_factor"]]);
    if (
      effectiveDate === null ||
      !ISO_DATE_PATTERN.test(effectiveDate) ||
      fromFactor === null ||
      toFactor === null
    ) {
      continue;
    }
    rows.push({
      effectiveDate,
      fromFactor,
      toFactor,
      providerEventId: `split-${symbol}-${effectiveDate}`,
    });
  }
  return rows;
}
