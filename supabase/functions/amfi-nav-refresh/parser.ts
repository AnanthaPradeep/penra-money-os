/**
 * Pure parser for AMFI's public NAVAll.txt feed
 * (https://www.amfiindia.com/spages/NAVAll.txt, redirects to
 * portal.amfiindia.com — `fetch`'s default redirect mode follows this) — no
 * network, no Deno- or Node-specific APIs, so this file runs unmodified
 * under both the deployed Deno Edge Function (./index.ts imports it
 * directly) and Vitest (./parser.test.ts). Keeping the two in one file is
 * deliberate: a duplicated copy could drift from what the Edge Function
 * actually ships.
 *
 * File shape (semicolon-delimited, undocumented outside AMFI's own site;
 * confirmed against the live feed while building this parser — Plan and
 * Option are their own columns, never guessed out of a combined scheme
 * name, so "Direct"/"Regular" and "Growth"/"IDCW" wording is always exactly
 * what AMFI published):
 *
 *   Scheme Code;ISIN Div Payout/ ISIN Growth;ISIN Div Reinvestment;Scheme Name;Plan;Option;Net Asset Value;Date
 *   <blank line>
 *   Open Ended Schemes(Debt Scheme - Banking and PSU Fund)
 *   <blank line>
 *   Aditya Birla Sun Life Mutual Fund
 *   <blank line>
 *   119551;INF209KA12Z1;INF209KA13Z9;Aditya Birla Sun Life Banking & PSU Debt Fund;Direct Plan;IDCW-Re-investment;106.9996;20-Aug-2026
 *   ...
 *
 * Category headings and AMC-name lines carry no semicolons and are
 * silently skipped, never treated as errors — they are a normal, expected
 * part of the file, not malformed data.
 */

export type ParsedAmfiRow = {
  schemeCode: string;
  isinGrowth: string | null;
  isinReinvestment: string | null;
  schemeName: string;
  /** e.g. "Direct Plan" / "Regular Plan" — AMFI's own text, never inferred. */
  plan: string;
  /** e.g. "Growth" / "IDCW-Re-investment" / "MONTHLY IDCW Payout" — AMFI's own text, never inferred. */
  option: string;
  /** Exact decimal text straight from the file — never parsed through a JS float. */
  nav: string;
  /** ISO 8601 calendar date (YYYY-MM-DD). */
  navDate: string;
};

export type AmfiParseIssueReason =
  | "wrong_field_count"
  | "invalid_scheme_code"
  | "missing_scheme_name"
  | "invalid_nav"
  | "invalid_date"
  | "duplicate_scheme_code";

export type AmfiParseIssue = {
  lineNumber: number;
  reason: AmfiParseIssueReason;
  raw: string;
};

export type AmfiParseResult = {
  rows: ParsedAmfiRow[];
  issues: AmfiParseIssue[];
};

const EXPECTED_HEADER_PREFIX = "SCHEME CODE;";

/** Whether `content` looks like a real AMFI NAVAll.txt response at all — rejects an HTML error page, an empty body, or an unrelated document before line-by-line parsing even starts. */
export function looksLikeAmfiNavContent(content: string): boolean {
  const trimmed = content.trimStart();
  if (trimmed.length === 0) {
    return false;
  }
  if (trimmed.startsWith("<")) {
    return false;
  }
  const firstLine = trimmed.split(/\r?\n/, 1)[0] ?? "";
  return firstLine.toUpperCase().startsWith(EXPECTED_HEADER_PREFIX);
}

const NAV_PATTERN = /^\d+(\.\d+)?$/;
const SCHEME_CODE_PATTERN = /^\d+$/;
const MONTH_ABBREVIATIONS: Record<string, string> = {
  jan: "01",
  feb: "02",
  mar: "03",
  apr: "04",
  may: "05",
  jun: "06",
  jul: "07",
  aug: "08",
  sep: "09",
  oct: "10",
  nov: "11",
  dec: "12",
};

/** Parses AMFI's "DD-Mon-YYYY" date format (e.g. "20-Aug-2026") into ISO form, without relying on the platform's `Date` string parser — that parser's behavior for two-digit years, locale, and ambiguous separators isn't guaranteed consistent, and this format needs none of its flexibility. */
function parseAmfiDate(raw: string): string | null {
  const match = /^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/.exec(raw.trim());
  if (!match) {
    return null;
  }
  const [, dayText, monthText, yearText] = match;
  const month = MONTH_ABBREVIATIONS[monthText!.toLowerCase()];
  if (!month) {
    return null;
  }
  const day = Number(dayText);
  if (day < 1 || day > 31) {
    return null;
  }
  return `${yearText}-${month}-${dayText!.padStart(2, "0")}`;
}

function normalizeIsin(raw: string): string | null {
  const trimmed = raw.trim();
  return trimmed.length === 0 || trimmed === "-" ? null : trimmed;
}

/**
 * Parses the full NAVAll.txt body. Never throws — every line either
 * contributes a row or an issue. Blank lines, the master header line, and
 * category/AMC-name lines are silently skipped (not reported as issues,
 * since they're an expected part of the file's structure, not malformed
 * data). A later occurrence of a scheme code already seen in this file is
 * recorded as a `duplicate_scheme_code` issue and dropped — the first
 * occurrence wins.
 */
export function parseAmfiNavAll(content: string): AmfiParseResult {
  const rows: ParsedAmfiRow[] = [];
  const issues: AmfiParseIssue[] = [];
  const seenSchemeCodes = new Set<string>();

  const lines = content.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const lineNumber = i + 1;
    const line = lines[i]!.trim();

    if (line.length === 0) {
      continue;
    }
    if (line.toUpperCase().startsWith(EXPECTED_HEADER_PREFIX)) {
      continue;
    }
    if (!line.includes(";")) {
      // A category heading or AMC name — expected, not an error.
      continue;
    }

    const fields = line.split(";");
    if (fields.length !== 8) {
      issues.push({ lineNumber, reason: "wrong_field_count", raw: line });
      continue;
    }

    const [
      schemeCodeRaw,
      isinGrowthRaw,
      isinReinvestmentRaw,
      schemeNameRaw,
      planRaw,
      optionRaw,
      navRaw,
      dateRaw,
    ] = fields as [
      string,
      string,
      string,
      string,
      string,
      string,
      string,
      string,
    ];

    const schemeCode = schemeCodeRaw.trim();
    if (!SCHEME_CODE_PATTERN.test(schemeCode)) {
      issues.push({ lineNumber, reason: "invalid_scheme_code", raw: line });
      continue;
    }

    const schemeName = schemeNameRaw.trim();
    if (schemeName.length === 0) {
      issues.push({ lineNumber, reason: "missing_scheme_name", raw: line });
      continue;
    }

    const nav = navRaw.trim();
    if (!NAV_PATTERN.test(nav) || Number(nav) <= 0) {
      issues.push({ lineNumber, reason: "invalid_nav", raw: line });
      continue;
    }

    const navDate = parseAmfiDate(dateRaw);
    if (!navDate) {
      issues.push({ lineNumber, reason: "invalid_date", raw: line });
      continue;
    }

    if (seenSchemeCodes.has(schemeCode)) {
      issues.push({ lineNumber, reason: "duplicate_scheme_code", raw: line });
      continue;
    }
    seenSchemeCodes.add(schemeCode);

    rows.push({
      schemeCode,
      isinGrowth: normalizeIsin(isinGrowthRaw),
      isinReinvestment: normalizeIsin(isinReinvestmentRaw),
      schemeName,
      plan: planRaw.trim(),
      option: optionRaw.trim(),
      nav,
      navDate,
    });
  }

  return { rows, issues };
}
