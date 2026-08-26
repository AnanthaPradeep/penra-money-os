import { describe, expect, it } from "vitest";

import {
  rankCandidates,
  scoreExistingTransactionCandidate,
  scoreTransferCandidate,
} from "@/lib/bank-import/matching";
import { Decimal } from "@/lib/money/decimal";
import type { ExistingLedgerRowForMatching } from "@/lib/bank-import/types";

function candidate(
  overrides: Partial<ExistingLedgerRowForMatching> = {},
): ExistingLedgerRowForMatching {
  return {
    transactionId: "txn-1",
    accountId: "acct-1",
    occurredOn: "2026-03-05",
    amount: new Decimal("500.00"),
    direction: "debit",
    description: "Grocery store",
    sourceReference: null,
    ...overrides,
  };
}

describe("scoreExistingTransactionCandidate", () => {
  it("returns null when amounts don't match", () => {
    const result = scoreExistingTransactionCandidate({
      rowDate: "2026-03-05",
      rowAmount: new Decimal("600.00"),
      rowDirection: "debit",
      rowDescription: "Grocery store",
      rowReference: null,
      candidate: candidate(),
      dateWindowDays: 3,
    });
    expect(result).toBeNull();
  });

  it("returns null when directions differ", () => {
    const result = scoreExistingTransactionCandidate({
      rowDate: "2026-03-05",
      rowAmount: new Decimal("500.00"),
      rowDirection: "credit",
      rowDescription: "Grocery store",
      rowReference: null,
      candidate: candidate({ direction: "debit" }),
      dateWindowDays: 3,
    });
    expect(result).toBeNull();
  });

  it("returns null when the date is outside the window", () => {
    const result = scoreExistingTransactionCandidate({
      rowDate: "2026-03-15",
      rowAmount: new Decimal("500.00"),
      rowDirection: "debit",
      rowDescription: "Grocery store",
      rowReference: null,
      candidate: candidate({ occurredOn: "2026-03-05" }),
      dateWindowDays: 3,
    });
    expect(result).toBeNull();
  });

  it("scores highest for an exact same-day, same-description match", () => {
    const result = scoreExistingTransactionCandidate({
      rowDate: "2026-03-05",
      rowAmount: new Decimal("500.00"),
      rowDirection: "debit",
      rowDescription: "Grocery store",
      rowReference: null,
      candidate: candidate(),
      dateWindowDays: 3,
    });
    expect(result).not.toBeNull();
    expect(result?.confidence).toBe("high");
    expect(result?.reasons.length).toBeGreaterThan(0);
    expect(result?.conflicts).toEqual([]);
  });

  it("scores lower and notes a conflict when the date is a few days off", () => {
    const result = scoreExistingTransactionCandidate({
      rowDate: "2026-03-08",
      rowAmount: new Decimal("500.00"),
      rowDirection: "debit",
      rowDescription: "Totally different text",
      rowReference: null,
      candidate: candidate({
        occurredOn: "2026-03-05",
        description: "Grocery store",
      }),
      dateWindowDays: 3,
    });
    expect(result).not.toBeNull();
    expect(result?.confidence).not.toBe("high");
    expect(result?.conflicts.length).toBeGreaterThan(0);
  });

  it("boosts score for a matching reference", () => {
    const withRef = scoreExistingTransactionCandidate({
      rowDate: "2026-03-05",
      rowAmount: new Decimal("500.00"),
      rowDirection: "debit",
      rowDescription: "x",
      rowReference: "UTR123",
      candidate: candidate({ sourceReference: "UTR123", description: "y" }),
      dateWindowDays: 3,
    });
    const withoutRef = scoreExistingTransactionCandidate({
      rowDate: "2026-03-05",
      rowAmount: new Decimal("500.00"),
      rowDirection: "debit",
      rowDescription: "x",
      rowReference: null,
      candidate: candidate({ sourceReference: null, description: "y" }),
      dateWindowDays: 3,
    });
    expect(withRef?.score ?? 0).toBeGreaterThan(withoutRef?.score ?? 0);
  });

  it("caps score at 1", () => {
    const result = scoreExistingTransactionCandidate({
      rowDate: "2026-03-05",
      rowAmount: new Decimal("500.00"),
      rowDirection: "debit",
      rowDescription: "Grocery store",
      rowReference: "UTR123",
      candidate: candidate({ sourceReference: "UTR123" }),
      dateWindowDays: 3,
    });
    expect(result?.score).toBeLessThanOrEqual(1);
  });
});

describe("scoreTransferCandidate", () => {
  const base = {
    rowDate: "2026-03-05",
    rowAmount: new Decimal("1000.00"),
    rowDirection: "debit" as const,
    rowAccountId: "acct-A",
    rowCurrency: "INR",
    rowDescription: "Transfer to savings",
    rowReference: null,
    candidateDate: "2026-03-05",
    candidateAmount: new Decimal("1000.00"),
    candidateDirection: "credit" as const,
    candidateAccountId: "acct-B",
    candidateCurrency: "INR",
    candidateDescription: "Transfer from current",
    candidateReference: null,
    dateWindowDays: 3,
  };

  it("returns null for the same account on both sides", () => {
    expect(
      scoreTransferCandidate({ ...base, candidateAccountId: "acct-A" }),
    ).toBeNull();
  });

  it("returns null for mismatched currencies", () => {
    expect(
      scoreTransferCandidate({ ...base, candidateCurrency: "USD" }),
    ).toBeNull();
  });

  it("returns null for unequal absolute amounts", () => {
    expect(
      scoreTransferCandidate({
        ...base,
        candidateAmount: new Decimal("999.00"),
      }),
    ).toBeNull();
  });

  it("returns null when directions are not opposite", () => {
    expect(
      scoreTransferCandidate({ ...base, candidateDirection: "debit" }),
    ).toBeNull();
  });

  it("returns null outside the date window", () => {
    expect(
      scoreTransferCandidate({ ...base, candidateDate: "2026-03-20" }),
    ).toBeNull();
  });

  it("scores a valid same-day opposite-direction pair as a high-confidence candidate", () => {
    const result = scoreTransferCandidate(base);
    expect(result).not.toBeNull();
    expect(result?.confidence).toBe("high");
  });
});

describe("rankCandidates", () => {
  it("sorts by score descending and caps the result length", () => {
    const candidates = [
      { score: 0.4, confidence: "low" as const, reasons: [], conflicts: [] },
      { score: 0.9, confidence: "high" as const, reasons: [], conflicts: [] },
      { score: 0.6, confidence: "medium" as const, reasons: [], conflicts: [] },
    ];
    const ranked = rankCandidates(candidates, 2);
    expect(ranked).toHaveLength(2);
    expect(ranked[0]?.score).toBe(0.9);
    expect(ranked[1]?.score).toBe(0.6);
  });
});
