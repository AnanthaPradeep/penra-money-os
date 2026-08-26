// No "server-only" guard here (unlike actions.ts/queries.ts): this module
// touches no secret and no privileged client — it's pure parsing over
// bytes the caller already has. It relies on node:crypto for hashing,
// which is itself unavailable in a browser bundle and so already fails
// loudly if ever imported into a client component. Kept import-able
// without a Next.js server-component context so its exhaustive security-
// hardening tests (parser.test.ts) can exercise it directly.
import { createHash } from "node:crypto";

import Papa from "papaparse";

import {
  ALLOWED_STATEMENT_EXTENSIONS,
  ALLOWED_STATEMENT_MIME_TYPES,
  MAX_STATEMENT_COLUMNS,
  MAX_STATEMENT_FIELD_LENGTH,
  MAX_STATEMENT_FILE_BYTES,
  MAX_STATEMENT_IMPORT_ROWS,
  MAX_STATEMENT_RAW_LINES,
} from "@/lib/bank-import/limits";
import type {
  RawParsedRow,
  StatementFileFormat,
  StatementTokenizeResult,
} from "@/lib/bank-import/types";

/**
 * Untrusted-file parsing pipeline for a bank/credit-card statement export.
 * Every check here runs before a single byte reaches column mapping or
 * matching logic — this file treats the upload as hostile input, per the
 * Phase 11 spec, and rejects rather than "best-effort recovers" from
 * anything it cannot safely interpret. Never evaluates a cell as a
 * formula, never loads the whole file into a spreadsheet-style grid
 * without bounds, and never trusts the declared extension/MIME type alone.
 */

const CANDIDATE_DELIMITERS = [",", ";", "\t"] as const;
type CandidateDelimiter = (typeof CANDIDATE_DELIMITERS)[number];

const NUL_CODE_POINT = 0;
const TAB_CODE_POINT = 9;
const LF_CODE_POINT = 10;
const CR_CODE_POINT = 13;
const DEL_CODE_POINT = 127;
const LAST_C0_CODE_POINT = 31;

/**
 * Sanitizes one raw cell character-by-character rather than through a
 * regex literal, so no literal control byte ever needs to sit in this
 * source file: tab is kept (legitimate mid-field), CR/LF (an embedded
 * newline inside a quoted multi-line field) collapses to a single space,
 * and every other C0 control character or DEL is dropped outright.
 */
function sanitizeCellText(value: string): string {
  let result = "";
  for (const char of value) {
    const codePoint = char.codePointAt(0) ?? 0;
    if (codePoint === TAB_CODE_POINT) {
      result += char;
    } else if (codePoint === CR_CODE_POINT || codePoint === LF_CODE_POINT) {
      result += " ";
    } else if (
      codePoint <= LAST_C0_CODE_POINT ||
      codePoint === DEL_CODE_POINT
    ) {
      // dropped
    } else {
      result += char;
    }
  }
  return result;
}

function containsNulByte(value: string): boolean {
  for (const char of value) {
    if (char.codePointAt(0) === NUL_CODE_POINT) {
      return true;
    }
  }
  return false;
}

function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function detectDelimiter(headerLine: string): CandidateDelimiter {
  let best: CandidateDelimiter = ",";
  let bestCount = -1;
  for (const candidate of CANDIDATE_DELIMITERS) {
    const count = headerLine.split(candidate).length - 1;
    if (count > bestCount) {
      bestCount = count;
      best = candidate;
    }
  }
  return best;
}

function computeHeaderFingerprint(header: string[]): string {
  const normalized = header.map((cell) => cell.trim().toLowerCase()).join("");
  return createHash("sha256").update(normalized).digest("hex");
}

/** Validates the declared filename/MIME against allowlists — a necessary but never sufficient check; content sniffing below is what actually decides. */
export function isPlausibleStatementFile(
  filename: string,
  mimeType: string,
): boolean {
  const lower = filename.toLowerCase();
  const hasAllowedExtension = ALLOWED_STATEMENT_EXTENSIONS.some((ext) =>
    lower.endsWith(ext),
  );
  const hasAllowedMime = (
    ALLOWED_STATEMENT_MIME_TYPES as readonly string[]
  ).includes(mimeType);
  return hasAllowedExtension && hasAllowedMime;
}

function inferFormat(
  filename: string,
  delimiter: CandidateDelimiter,
): StatementFileFormat {
  if (filename.toLowerCase().endsWith(".tsv") || delimiter === "\t") {
    return "tsv";
  }
  return "csv";
}

/**
 * Tokenizes raw uploaded bytes into a header row and data rows. Nothing
 * past this point is interpreted as a date/amount/direction yet — that is
 * normalize.ts's job, operating on the plain strings this function
 * produces after column mapping is confirmed.
 */
export function parseStatementFile(
  bytes: Uint8Array,
  filename: string,
  mimeType: string,
): StatementTokenizeResult {
  if (bytes.byteLength === 0) {
    return { success: false, error: "The file is empty." };
  }
  if (bytes.byteLength > MAX_STATEMENT_FILE_BYTES) {
    return {
      success: false,
      error: `The file is larger than the ${Math.floor(MAX_STATEMENT_FILE_BYTES / (1024 * 1024))}MB limit.`,
    };
  }
  if (!isPlausibleStatementFile(filename, mimeType)) {
    return {
      success: false,
      error: "Only .csv, .tsv, or .txt files are supported.",
    };
  }

  let decoded: string;
  try {
    decoded = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return {
      success: false,
      error:
        "The file is not valid UTF-8 text. Re-export it as UTF-8 CSV and try again.",
    };
  }

  if (containsNulByte(decoded)) {
    return {
      success: false,
      error: "The file contains binary data and cannot be read as a statement.",
    };
  }

  const withoutBom = stripBom(decoded);
  const normalizedNewlines = withoutBom
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");

  const rawLineCount = normalizedNewlines.split("\n").length;
  if (rawLineCount > MAX_STATEMENT_RAW_LINES) {
    return {
      success: false,
      error: "The file has too many lines to import safely.",
    };
  }

  const firstLine = normalizedNewlines.split("\n", 1)[0] ?? "";
  if (firstLine.trim().length === 0) {
    return { success: false, error: "The file has no header row." };
  }
  const delimiter = detectDelimiter(firstLine);

  const parsed = Papa.parse<string[]>(normalizedNewlines, {
    delimiter,
    header: false,
    skipEmptyLines: "greedy",
    quoteChar: '"',
    escapeChar: '"',
    dynamicTyping: false,
  });

  if (parsed.data.length === 0) {
    return { success: false, error: "The file has no rows to import." };
  }

  const rawHeader = parsed.data[0] ?? [];
  if (rawHeader.length > MAX_STATEMENT_COLUMNS) {
    return {
      success: false,
      error: "The file has more columns than a bank statement should.",
    };
  }
  if (rawHeader.some((cell) => cell.trim().length === 0)) {
    return {
      success: false,
      error:
        "Every column must have a header — the file has a blank column heading.",
    };
  }

  const seenHeaders = new Set<string>();
  for (const cell of rawHeader) {
    const key = cell.trim().toLowerCase();
    if (seenHeaders.has(key)) {
      return {
        success: false,
        error: `The file has a duplicate column heading: "${cell.trim()}".`,
      };
    }
    seenHeaders.add(key);
  }

  const header = rawHeader.map((cell) => cell.trim());
  const dataLines = parsed.data.slice(1);

  if (dataLines.length === 0) {
    return {
      success: false,
      error: "The file has a header but no data rows.",
    };
  }
  if (dataLines.length > MAX_STATEMENT_IMPORT_ROWS) {
    return {
      success: false,
      error: `This file has more than ${MAX_STATEMENT_IMPORT_ROWS} rows. Split it and import in smaller batches.`,
    };
  }

  const rows: RawParsedRow[] = [];
  for (const [index, line] of dataLines.entries()) {
    const cells = line.map((cell) =>
      sanitizeCellText(cell).slice(0, MAX_STATEMENT_FIELD_LENGTH),
    );
    rows.push({ rowIndex: index, cells });
  }

  return {
    success: true,
    format: inferFormat(filename, delimiter),
    delimiter,
    encoding: "utf-8",
    header,
    headerFingerprint: computeHeaderFingerprint(header),
    rows,
    fileHash: sha256Hex(bytes),
    fileSizeBytes: bytes.byteLength,
  };
}
