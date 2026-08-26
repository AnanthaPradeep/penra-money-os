import { computeDescriptionMatchKey } from "@/lib/bank-import/normalize";
import type {
  ExistingLedgerRowForMatching,
  MatchConfidence,
  RowDirection,
} from "@/lib/bank-import/types";
import type { Money } from "@/lib/money/decimal";

/**
 * Pure, deterministic, explainable candidate scoring — the counterpart to
 * the database layer's hard safety net (ownership, RLS, the one-link-per-
 * transaction unique index). Nothing here is machine-learned or opaque:
 * every point added to a score has a named, human-readable reason, and
 * every candidate a hard rule disqualifies is simply never produced,
 * rather than produced with a misleadingly low score. Confirming any
 * candidate this module returns is always a separate, explicit user
 * action (see confirm_statement_transfer_match /
 * link_statement_import_row_to_transaction) — nothing here posts or links
 * on its own.
 */

export type ScoredCandidate = {
  score: number;
  confidence: MatchConfidence;
  reasons: string[];
  conflicts: string[];
};

const MIN_SURFACED_SCORE = 0.3;
const HIGH_CONFIDENCE_THRESHOLD = 0.75;
const MEDIUM_CONFIDENCE_THRESHOLD = 0.5;

function confidenceForScore(score: number): MatchConfidence {
  if (score >= HIGH_CONFIDENCE_THRESHOLD) {
    return "high";
  }
  if (score >= MEDIUM_CONFIDENCE_THRESHOLD) {
    return "medium";
  }
  return "low";
}

function clampScore(score: number): number {
  return Math.min(1, Math.max(0, score));
}

function daysBetween(a: string, b: string): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return (
    Math.abs(Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) /
    msPerDay
  );
}

/** exact / high-overlap / low-overlap — a bounded, explainable substitute for opaque fuzzy-string-distance scoring. */
function describeTextSimilarity(
  a: string,
  b: string,
): { tier: "exact" | "high" | "low" | "none"; points: number } {
  const keyA = computeDescriptionMatchKey(a);
  const keyB = computeDescriptionMatchKey(b);
  if (keyA.length === 0 || keyB.length === 0) {
    return { tier: "none", points: 0 };
  }
  if (keyA === keyB) {
    return { tier: "exact", points: 0.3 };
  }
  if (
    keyA.length >= 4 &&
    keyB.length >= 4 &&
    (keyA.includes(keyB) || keyB.includes(keyA))
  ) {
    return { tier: "high", points: 0.2 };
  }
  const tokensA = new Set(keyA.split(" ").filter((t) => t.length >= 3));
  const tokensB = new Set(keyB.split(" ").filter((t) => t.length >= 3));
  if (tokensA.size === 0 || tokensB.size === 0) {
    return { tier: "none", points: 0 };
  }
  let overlap = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) {
      overlap += 1;
    }
  }
  const ratio = overlap / Math.min(tokensA.size, tokensB.size);
  if (ratio >= 0.6) {
    return { tier: "high", points: 0.15 };
  }
  if (ratio > 0) {
    return { tier: "low", points: 0.05 };
  }
  return { tier: "none", points: 0 };
}

export type ExistingTransactionCandidateInput = {
  rowDate: string;
  rowAmount: Money;
  rowDirection: RowDirection;
  rowDescription: string;
  rowReference: string | null;
  candidate: ExistingLedgerRowForMatching;
  dateWindowDays: number;
};

/**
 * Scores one already-posted ledger transaction as a candidate match for
 * one statement row. The caller is responsible for having already
 * restricted `candidate` to the same account/currency and a bounded date
 * window via an indexed query — this function only ever compares the two
 * records it is given, never scans anything itself.
 */
export function scoreExistingTransactionCandidate(
  input: ExistingTransactionCandidateInput,
): ScoredCandidate | null {
  const {
    rowDate,
    rowAmount,
    rowDirection,
    rowDescription,
    rowReference,
    candidate,
    dateWindowDays,
  } = input;

  if (!rowAmount.abs().equals(candidate.amount.abs())) {
    return null;
  }
  if (rowDirection !== candidate.direction) {
    return null;
  }

  const dayDiff = daysBetween(rowDate, candidate.occurredOn);
  if (dayDiff > dateWindowDays) {
    return null;
  }

  const reasons: string[] = [
    `Same amount (${rowAmount.abs().toFixed(2)})`,
    `Same direction (${rowDirection})`,
  ];
  const conflicts: string[] = [];
  let score = 0.3;

  if (dayDiff === 0) {
    score += 0.4;
    reasons.push("Same date");
  } else if (dayDiff <= 1) {
    score += 0.3;
    reasons.push("Date within 1 day");
  } else {
    score += 0.15;
    conflicts.push(`Date is ${Math.round(dayDiff)} day(s) apart`);
  }

  const similarity = describeTextSimilarity(
    rowDescription,
    candidate.description,
  );
  score += similarity.points;
  if (similarity.tier === "exact") {
    reasons.push("Description matches exactly");
  } else if (similarity.tier === "high") {
    reasons.push("Description is very similar");
  } else if (similarity.tier === "none") {
    conflicts.push("Description differs");
  }

  if (
    rowReference &&
    candidate.sourceReference &&
    rowReference === candidate.sourceReference
  ) {
    score += 0.3;
    reasons.push("Reference matches exactly");
  }

  const finalScore = clampScore(score);
  if (finalScore < MIN_SURFACED_SCORE) {
    return null;
  }

  return {
    score: finalScore,
    confidence: confidenceForScore(finalScore),
    reasons,
    conflicts,
  };
}

export type TransferCandidateInput = {
  rowDate: string;
  rowAmount: Money;
  rowDirection: RowDirection;
  rowAccountId: string;
  rowCurrency: string;
  rowDescription: string;
  rowReference: string | null;
  candidateDate: string;
  candidateAmount: Money;
  candidateDirection: RowDirection;
  candidateAccountId: string;
  candidateCurrency: string;
  candidateDescription: string;
  candidateReference: string | null;
  dateWindowDays: number;
};

/**
 * Scores whether two statement rows (possibly from two different imports —
 * one bank statement's debit leg and a credit-card statement's credit leg,
 * for example) look like the two sides of one internal transfer or
 * credit-card payment. The hard structural requirements — equal absolute
 * amount, opposite direction, different accounts, matching currency — are
 * prerequisites for a candidate existing at all, exactly mirroring what
 * confirm_statement_transfer_match itself re-validates before linking; a
 * pair that fails any of them is never returned as a candidate, not
 * returned with a low score.
 */
export function scoreTransferCandidate(
  input: TransferCandidateInput,
): ScoredCandidate | null {
  if (input.rowAccountId === input.candidateAccountId) {
    return null;
  }
  if (input.rowCurrency !== input.candidateCurrency) {
    return null;
  }
  if (!input.rowAmount.abs().equals(input.candidateAmount.abs())) {
    return null;
  }
  if (input.rowDirection === input.candidateDirection) {
    return null;
  }

  const dayDiff = daysBetween(input.rowDate, input.candidateDate);
  if (dayDiff > input.dateWindowDays) {
    return null;
  }

  const reasons: string[] = [
    `Equal amount (${input.rowAmount.abs().toFixed(2)})`,
    "Opposite debit/credit directions",
    "Different accounts",
  ];
  const conflicts: string[] = [];
  let score = 0.4;

  if (dayDiff === 0) {
    score += 0.35;
    reasons.push("Same date");
  } else if (dayDiff <= 1) {
    score += 0.25;
    reasons.push("Date within 1 day");
  } else {
    score += 0.1;
    conflicts.push(`Date is ${Math.round(dayDiff)} day(s) apart`);
  }

  const similarity = describeTextSimilarity(
    input.rowDescription,
    input.candidateDescription,
  );
  score += similarity.points;
  if (similarity.tier === "exact" || similarity.tier === "high") {
    reasons.push("Descriptions look related");
  }

  if (
    input.rowReference &&
    input.candidateReference &&
    input.rowReference === input.candidateReference
  ) {
    score += 0.25;
    reasons.push("Reference matches exactly");
  }

  const finalScore = clampScore(score);
  if (finalScore < MIN_SURFACED_SCORE) {
    return null;
  }

  return {
    score: finalScore,
    confidence: confidenceForScore(finalScore),
    reasons,
    conflicts,
  };
}

/**
 * Ranks and caps candidates for one row — the review UI only ever shows a
 * short, useful list, never every technically-possible candidate.
 */
export function rankCandidates<T extends ScoredCandidate>(
  candidates: T[],
  maxCandidates = 5,
): T[] {
  return [...candidates]
    .sort((a, b) => b.score - a.score)
    .slice(0, maxCandidates);
}
