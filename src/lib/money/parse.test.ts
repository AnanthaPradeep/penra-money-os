import { describe, expect, it } from "vitest";

import { parsePositiveMoneyInput, toDbAmountString } from "@/lib/money/parse";

describe("parsePositiveMoneyInput", () => {
  it("accepts a plain integer amount", () => {
    const result = parsePositiveMoneyInput("500");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.toString()).toBe("500");
    }
  });

  it("accepts an amount with decimal places", () => {
    const result = parsePositiveMoneyInput("1234.5");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.toString()).toBe("1234.5");
    }
  });

  it("accepts an amount at the 4-decimal-place boundary", () => {
    const result = parsePositiveMoneyInput("99.9999");
    expect(result.success).toBe(true);
  });

  it("trims surrounding whitespace", () => {
    const result = parsePositiveMoneyInput("  250.50  ");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.toString()).toBe("250.5");
    }
  });

  it("rejects an empty string", () => {
    const result = parsePositiveMoneyInput("");
    expect(result.success).toBe(false);
  });

  it("rejects whitespace-only input", () => {
    const result = parsePositiveMoneyInput("   ");
    expect(result.success).toBe(false);
  });

  it("rejects zero", () => {
    const result = parsePositiveMoneyInput("0");
    expect(result.success).toBe(false);
  });

  it("rejects zero with decimal places", () => {
    const result = parsePositiveMoneyInput("0.0000");
    expect(result.success).toBe(false);
  });

  it("rejects a negative amount", () => {
    const result = parsePositiveMoneyInput("-500");
    expect(result.success).toBe(false);
  });

  it("rejects a leading plus sign", () => {
    const result = parsePositiveMoneyInput("+500");
    expect(result.success).toBe(false);
  });

  it("rejects scientific notation", () => {
    const result = parsePositiveMoneyInput("1e3");
    expect(result.success).toBe(false);
  });

  it("rejects Infinity", () => {
    const result = parsePositiveMoneyInput("Infinity");
    expect(result.success).toBe(false);
  });

  it("rejects NaN", () => {
    const result = parsePositiveMoneyInput("NaN");
    expect(result.success).toBe(false);
  });

  it("rejects more than 4 decimal places", () => {
    const result = parsePositiveMoneyInput("1.23456");
    expect(result.success).toBe(false);
  });

  it("rejects more than 16 integer digits", () => {
    const result = parsePositiveMoneyInput("12345678901234567");
    expect(result.success).toBe(false);
  });

  it("accepts exactly 16 integer digits", () => {
    const result = parsePositiveMoneyInput("1234567890123456");
    expect(result.success).toBe(true);
  });

  it("rejects thousands separators", () => {
    const result = parsePositiveMoneyInput("1,000");
    expect(result.success).toBe(false);
  });

  it("rejects a currency symbol", () => {
    const result = parsePositiveMoneyInput("₹500");
    expect(result.success).toBe(false);
  });

  it("rejects non-numeric text", () => {
    const result = parsePositiveMoneyInput("abc");
    expect(result.success).toBe(false);
  });

  it("rejects multiple decimal points", () => {
    const result = parsePositiveMoneyInput("1.2.3");
    expect(result.success).toBe(false);
  });

  it("rejects hexadecimal-looking input", () => {
    const result = parsePositiveMoneyInput("0x10");
    expect(result.success).toBe(false);
  });
});

describe("toDbAmountString", () => {
  it("formats to exactly 4 decimal places", () => {
    const parsed = parsePositiveMoneyInput("500");
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(toDbAmountString(parsed.value)).toBe("500.0000");
    }
  });

  it("preserves an amount already at 4 decimal places", () => {
    const parsed = parsePositiveMoneyInput("1234.5678");
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(toDbAmountString(parsed.value)).toBe("1234.5678");
    }
  });

  it("pads a single decimal place out to 4", () => {
    const parsed = parsePositiveMoneyInput("10.5");
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(toDbAmountString(parsed.value)).toBe("10.5000");
    }
  });
});
