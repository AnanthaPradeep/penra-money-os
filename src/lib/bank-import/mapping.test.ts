import { describe, expect, it } from "vitest";

import {
  amountShapeForMapping,
  detectColumnMapping,
  inferBaseTransactionType,
} from "@/lib/bank-import/mapping";

describe("detectColumnMapping", () => {
  it("detects a typical Indian bank statement header", () => {
    const header = [
      "Txn Date",
      "Narration",
      "Debit",
      "Credit",
      "Balance",
      "Ref No",
    ];
    const result = detectColumnMapping(header);
    expect(result.suggested.dateColumn).toBe("Txn Date");
    expect(result.suggested.descriptionColumn).toBe("Narration");
    expect(result.suggested.debitColumn).toBe("Debit");
    expect(result.suggested.creditColumn).toBe("Credit");
    expect(result.suggested.balanceColumn).toBe("Balance");
    expect(result.suggested.referenceColumn).toBe("Ref No");
    expect(result.confidence).toBe("high");
  });

  it("detects a single-amount-column header", () => {
    const header = ["Date", "Description", "Amount"];
    const result = detectColumnMapping(header);
    expect(result.suggested.amountColumn).toBe("Amount");
    expect(result.suggested.debitColumn).toBeUndefined();
    expect(result.suggested.creditColumn).toBeUndefined();
  });

  it("prefers debit/credit columns over a generic amount column when both exist", () => {
    const header = ["Date", "Description", "Debit", "Credit", "Amount"];
    const result = detectColumnMapping(header);
    expect(result.suggested.debitColumn).toBe("Debit");
    expect(result.suggested.amountColumn).toBeUndefined();
  });

  it("returns low confidence for an unrecognizable header", () => {
    const header = ["Col1", "Col2", "Col3"];
    const result = detectColumnMapping(header);
    expect(result.confidence).toBe("low");
  });

  it("carries a human-readable reason for each suggested field", () => {
    const header = ["Date", "Narration", "Amount"];
    const result = detectColumnMapping(header);
    expect(result.reasons.dateColumn).toContain("Date");
  });
});

describe("inferBaseTransactionType", () => {
  it("infers income for a credit into a bank account", () => {
    expect(inferBaseTransactionType("credit", "bank_savings")).toBe("income");
  });

  it("infers expense for a debit from a bank account", () => {
    expect(inferBaseTransactionType("debit", "bank_savings")).toBe("expense");
  });

  it("infers credit_card_payment for a credit into a credit card account", () => {
    expect(inferBaseTransactionType("credit", "credit_card")).toBe(
      "credit_card_payment",
    );
  });

  it("infers credit_card_purchase for a debit from a credit card account", () => {
    expect(inferBaseTransactionType("debit", "credit_card")).toBe(
      "credit_card_purchase",
    );
  });
});

describe("amountShapeForMapping", () => {
  it("is debit_credit_columns when a debit column is present", () => {
    expect(amountShapeForMapping({ debitColumn: "Debit" })).toBe(
      "debit_credit_columns",
    );
  });

  it("is debit_credit_columns when only a credit column is present", () => {
    expect(amountShapeForMapping({ creditColumn: "Credit" })).toBe(
      "debit_credit_columns",
    );
  });

  it("is signed_amount_column when only an amount column is present", () => {
    expect(amountShapeForMapping({ amountColumn: "Amount" })).toBe(
      "signed_amount_column",
    );
  });
});
