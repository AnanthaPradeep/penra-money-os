import { describe, expect, it } from "vitest";

import {
  computeDescriptionMatchKey,
  normalizeStatementRow,
} from "@/lib/bank-import/normalize";
import type { StatementColumnMapping } from "@/lib/bank-import/types";

const HEADER = [
  "Date",
  "Description",
  "Debit",
  "Credit",
  "Reference",
  "Balance",
];

const DEBIT_CREDIT_MAPPING: StatementColumnMapping = {
  dateColumn: "Date",
  descriptionColumn: "Description",
  debitColumn: "Debit",
  creditColumn: "Credit",
  referenceColumn: "Reference",
  balanceColumn: "Balance",
  dateFormat: "DD/MM/YYYY",
  amountSignConvention: "debit_negative",
};

function row(cells: string[], rowIndex = 0) {
  return normalizeStatementRow({
    rawRow: { rowIndex, cells },
    header: HEADER,
    mapping: DEBIT_CREDIT_MAPPING,
    amountShape: "debit_credit_columns",
    todayIstDate: "2026-08-25",
    importCurrency: "INR",
  });
}

describe("normalizeStatementRow", () => {
  it("normalizes a clean debit row", () => {
    const result = row([
      "05/03/2026",
      "Grocery store",
      "500.00",
      "",
      "REF1",
      "10000.00",
    ]);
    expect(result.transactionDate).toBe("2026-03-05");
    expect(result.description).toBe("Grocery store");
    expect(result.amount?.toString()).toBe("500");
    expect(result.direction).toBe("debit");
    expect(result.reference).toBe("REF1");
    expect(result.runningBalance?.toString()).toBe("10000");
    expect(result.currency).toBe("INR");
    expect(result.validationErrors).toEqual([]);
  });

  it("normalizes a clean credit row", () => {
    const result = row(["05/03/2026", "Salary", "", "50000.00", "", ""]);
    expect(result.direction).toBe("credit");
    expect(result.amount?.toString()).toBe("50000");
  });

  it("flags a missing date", () => {
    const result = row(["", "Grocery store", "500.00", "", "", ""]);
    expect(result.transactionDate).toBeNull();
    expect(result.validationErrors.some((e) => e.code === "missing_date")).toBe(
      true,
    );
  });

  it("flags an invalid date", () => {
    const result = row(["not-a-date", "Grocery store", "500.00", "", "", ""]);
    expect(result.transactionDate).toBeNull();
    expect(result.validationErrors.some((e) => e.code === "invalid_date")).toBe(
      true,
    );
  });

  it("flags a future date but still parses it", () => {
    const result = row(["01/01/2030", "Grocery store", "500.00", "", "", ""]);
    expect(result.transactionDate).toBe("2030-01-01");
    expect(result.validationErrors.some((e) => e.code === "future_date")).toBe(
      true,
    );
  });

  it("flags a missing description", () => {
    const result = row(["05/03/2026", "", "500.00", "", "", ""]);
    expect(
      result.validationErrors.some((e) => e.code === "missing_description"),
    ).toBe(true);
  });

  it("flags both debit and credit populated", () => {
    const result = row([
      "05/03/2026",
      "Grocery store",
      "500.00",
      "200.00",
      "",
      "",
    ]);
    expect(result.amount).toBeNull();
    expect(
      result.validationErrors.some((e) => e.code === "both_debit_and_credit"),
    ).toBe(true);
  });

  it("flags neither debit nor credit populated", () => {
    const result = row(["05/03/2026", "Grocery store", "", "", "", ""]);
    expect(
      result.validationErrors.some(
        (e) => e.code === "neither_debit_nor_credit",
      ),
    ).toBe(true);
  });

  it("neutralizes a formula-leading description", () => {
    const result = row([
      "05/03/2026",
      "=CMD|'/C calc'!A1",
      "500.00",
      "",
      "",
      "",
    ]);
    expect(result.description.startsWith("'")).toBe(true);
    expect(result.description).toContain("=CMD");
  });

  it("does not mutate an ordinary hyphenated description beyond the leading char rule", () => {
    const result = row([
      "05/03/2026",
      "-Refund adjustment",
      "500.00",
      "",
      "",
      "",
    ]);
    expect(result.description.startsWith("'-")).toBe(true);
  });

  it("caps description length", () => {
    const longDescription = "x".repeat(1000);
    const result = row(["05/03/2026", longDescription, "500.00", "", "", ""]);
    expect(result.description.length).toBeLessThanOrEqual(500);
  });

  it("produces a stable row hash for identical cells", () => {
    const a = row(["05/03/2026", "Grocery store", "500.00", "", "", ""]);
    const b = row(["05/03/2026", "Grocery store", "500.00", "", "", ""]);
    expect(a.rowHash).toBe(b.rowHash);
  });

  it("produces different row hashes for different cells", () => {
    const a = row(["05/03/2026", "Grocery store", "500.00", "", "", ""]);
    const b = row(["05/03/2026", "Grocery store", "600.00", "", "", ""]);
    expect(a.rowHash).not.toBe(b.rowHash);
  });

  it("ignores an unparseable running balance without failing the row", () => {
    const result = row([
      "05/03/2026",
      "Grocery store",
      "500.00",
      "",
      "",
      "not-a-balance",
    ]);
    expect(result.runningBalance).toBeNull();
    expect(result.amount?.toString()).toBe("500");
  });

  it("reads a negative running balance", () => {
    const result = row([
      "05/03/2026",
      "Grocery store",
      "500.00",
      "",
      "",
      "-250.00",
    ]);
    expect(result.runningBalance?.toString()).toBe("-250");
  });
});

describe("normalizeStatementRow with a signed amount column", () => {
  const SIGNED_MAPPING: StatementColumnMapping = {
    dateColumn: "Date",
    descriptionColumn: "Description",
    amountColumn: "Debit",
    dateFormat: "DD/MM/YYYY",
    amountSignConvention: "debit_negative",
  };

  it("resolves a negative signed amount as a debit", () => {
    const result = normalizeStatementRow({
      rawRow: {
        rowIndex: 0,
        cells: ["05/03/2026", "Grocery store", "-500.00", "", "", ""],
      },
      header: HEADER,
      mapping: SIGNED_MAPPING,
      amountShape: "signed_amount_column",
      todayIstDate: "2026-08-25",
      importCurrency: "INR",
    });
    expect(result.direction).toBe("debit");
    expect(result.amount?.toString()).toBe("500");
  });
});

describe("computeDescriptionMatchKey", () => {
  it("lowercases and collapses whitespace", () => {
    expect(computeDescriptionMatchKey("  Grocery   STORE  ")).toBe(
      "grocery store",
    );
  });

  it("returns an empty string for an empty description", () => {
    expect(computeDescriptionMatchKey("")).toBe("");
  });
});
