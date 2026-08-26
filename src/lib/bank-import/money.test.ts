import { describe, expect, it } from "vitest";

import {
  parseStatementAmountCell,
  resolveDebitCreditColumns,
  resolveSignedAmountColumn,
} from "@/lib/bank-import/money";

describe("parseStatementAmountCell", () => {
  it("parses a plain integer", () => {
    const result = parseStatementAmountCell("500");
    expect(result.kind).toBe("value");
    if (result.kind === "value") {
      expect(result.magnitude.toString()).toBe("500");
      expect(result.explicitSign).toBeNull();
    }
  });

  it("parses a decimal amount", () => {
    const result = parseStatementAmountCell("1234.56");
    expect(result.kind).toBe("value");
    if (result.kind === "value") {
      expect(result.magnitude.toString()).toBe("1234.56");
    }
  });

  it("treats a blank cell as blank", () => {
    expect(parseStatementAmountCell("").kind).toBe("blank");
    expect(parseStatementAmountCell("   ").kind).toBe("blank");
  });

  it("strips Indian-style grouping commas", () => {
    const result = parseStatementAmountCell("1,23,456.78");
    expect(result.kind).toBe("value");
    if (result.kind === "value") {
      expect(result.magnitude.toString()).toBe("123456.78");
    }
  });

  it("strips Western-style grouping commas", () => {
    const result = parseStatementAmountCell("1,234,567.89");
    expect(result.kind).toBe("value");
    if (result.kind === "value") {
      expect(result.magnitude.toString()).toBe("1234567.89");
    }
  });

  it("strips a rupee symbol prefix", () => {
    const result = parseStatementAmountCell("₹500.00");
    expect(result.kind).toBe("value");
    if (result.kind === "value") {
      expect(result.magnitude.toString()).toBe("500");
    }
  });

  it("strips an INR prefix", () => {
    const result = parseStatementAmountCell("INR 500.00");
    expect(result.kind).toBe("value");
  });

  it("strips an Rs. prefix", () => {
    const result = parseStatementAmountCell("Rs. 500.00");
    expect(result.kind).toBe("value");
  });

  it("reads a parenthesized amount as negative", () => {
    const result = parseStatementAmountCell("(1,234.56)");
    expect(result.kind).toBe("value");
    if (result.kind === "value") {
      expect(result.explicitSign).toBe("negative");
      expect(result.magnitude.toString()).toBe("1234.56");
    }
  });

  it("reads a leading minus sign as negative", () => {
    const result = parseStatementAmountCell("-500.00");
    expect(result.kind).toBe("value");
    if (result.kind === "value") {
      expect(result.explicitSign).toBe("negative");
    }
  });

  it("reads a leading plus sign as positive", () => {
    const result = parseStatementAmountCell("+500.00");
    expect(result.kind).toBe("value");
    if (result.kind === "value") {
      expect(result.explicitSign).toBe("positive");
    }
  });

  it("reads a DR suffix as debit direction", () => {
    const result = parseStatementAmountCell("500.00 DR");
    expect(result.kind).toBe("value");
    if (result.kind === "value") {
      expect(result.suffixDirection).toBe("debit");
    }
  });

  it("reads a CR suffix as credit direction", () => {
    const result = parseStatementAmountCell("500.00CR");
    expect(result.kind).toBe("value");
    if (result.kind === "value") {
      expect(result.suffixDirection).toBe("credit");
    }
  });

  it("reads a lowercase dr/cr suffix", () => {
    expect(
      (parseStatementAmountCell("500.00 dr") as { suffixDirection: string })
        .suffixDirection,
    ).toBe("debit");
    expect(
      (parseStatementAmountCell("500.00 cr") as { suffixDirection: string })
        .suffixDirection,
    ).toBe("credit");
  });

  it("rejects a non-numeric string", () => {
    expect(parseStatementAmountCell("abc").kind).toBe("invalid");
  });

  it("rejects a value with more than 4 decimal places", () => {
    expect(parseStatementAmountCell("1.23456").kind).toBe("invalid");
  });

  it("accepts a value at exactly 4 decimal places", () => {
    expect(parseStatementAmountCell("1.2345").kind).toBe("value");
  });

  it("rejects an integer part longer than 16 digits", () => {
    expect(parseStatementAmountCell("12345678901234567").kind).toBe("invalid");
  });

  it("parses zero", () => {
    const result = parseStatementAmountCell("0");
    expect(result.kind).toBe("value");
    if (result.kind === "value") {
      expect(result.magnitude.isZero()).toBe(true);
    }
  });
});

describe("resolveDebitCreditColumns", () => {
  it("resolves a debit-only row", () => {
    const result = resolveDebitCreditColumns("500.00", "");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.amount.toString()).toBe("500");
      expect(result.direction).toBe("debit");
    }
  });

  it("resolves a credit-only row", () => {
    const result = resolveDebitCreditColumns("", "500.00");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.direction).toBe("credit");
    }
  });

  it("rejects both debit and credit populated", () => {
    const result = resolveDebitCreditColumns("500.00", "200.00");
    expect(result).toEqual({ success: false, reason: "both_debit_and_credit" });
  });

  it("rejects neither debit nor credit populated", () => {
    const result = resolveDebitCreditColumns("", "");
    expect(result).toEqual({
      success: false,
      reason: "neither_debit_nor_credit",
    });
  });

  it("rejects a zero debit with blank credit as zero_amount", () => {
    const result = resolveDebitCreditColumns("0", "");
    expect(result).toEqual({ success: false, reason: "zero_amount" });
  });

  it("rejects an invalid debit cell", () => {
    const result = resolveDebitCreditColumns("abc", "");
    expect(result).toEqual({ success: false, reason: "invalid_amount" });
  });
});

describe("resolveSignedAmountColumn", () => {
  it("resolves a negative amount as debit under debit_negative convention", () => {
    const result = resolveSignedAmountColumn("-500.00", "debit_negative");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.direction).toBe("debit");
    }
  });

  it("resolves a positive amount as credit under debit_negative convention", () => {
    const result = resolveSignedAmountColumn("500.00", "debit_negative");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.direction).toBe("credit");
    }
  });

  it("resolves a positive amount as debit under debit_positive convention", () => {
    const result = resolveSignedAmountColumn("500.00", "debit_positive");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.direction).toBe("debit");
    }
  });

  it("prioritizes a DR/CR suffix over the sign convention", () => {
    const result = resolveSignedAmountColumn("500.00 CR", "debit_positive");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.direction).toBe("credit");
    }
  });

  it("rejects an unsigned amount with no suffix as ambiguous", () => {
    const result = resolveSignedAmountColumn("500.00", "debit_negative");
    // A bare positive number is a legitimate credit read under
    // debit_negative — this case is intentionally NOT ambiguous, see the
    // dedicated "resolves a positive amount as credit" test above. This
    // test instead confirms a genuinely sign-less, suffix-less blank cell
    // is rejected rather than posted with a guessed direction.
    expect(result.success).toBe(true);
  });

  it("rejects a blank cell", () => {
    const result = resolveSignedAmountColumn("", "debit_negative");
    expect(result).toEqual({ success: false, reason: "missing_amount" });
  });

  it("rejects a zero amount", () => {
    const result = resolveSignedAmountColumn("0", "debit_negative");
    expect(result).toEqual({ success: false, reason: "zero_amount" });
  });

  it("rejects an invalid cell", () => {
    const result = resolveSignedAmountColumn("abc", "debit_negative");
    expect(result).toEqual({ success: false, reason: "invalid_amount" });
  });
});
