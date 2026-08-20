import { describe, expect, it } from "vitest";

import {
  parseOptionalSignedDecimalInput,
  parsePositiveQuantityInput,
  toDbQuantityString,
} from "@/lib/investments/parse";
import { Decimal } from "@/lib/money/decimal";

describe("parsePositiveQuantityInput", () => {
  it("accepts a whole-number quantity", () => {
    const result = parsePositiveQuantityInput("10");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.toString()).toBe("10");
    }
  });

  it("accepts a quantity with up to 6 decimal places (mutual fund units)", () => {
    const result = parsePositiveQuantityInput("100.123456");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.toString()).toBe("100.123456");
    }
  });

  it("rejects more than 6 decimal places", () => {
    const result = parsePositiveQuantityInput("1.1234567");
    expect(result.success).toBe(false);
  });

  it("rejects zero", () => {
    const result = parsePositiveQuantityInput("0");
    expect(result.success).toBe(false);
  });

  it("rejects a negative value", () => {
    const result = parsePositiveQuantityInput("-5");
    expect(result.success).toBe(false);
  });

  it("rejects blank input", () => {
    const result = parsePositiveQuantityInput("   ");
    expect(result.success).toBe(false);
  });

  it("rejects scientific notation", () => {
    const result = parsePositiveQuantityInput("1e3");
    expect(result.success).toBe(false);
  });
});

describe("toDbQuantityString", () => {
  it("always renders exactly 6 decimal places", () => {
    expect(toDbQuantityString(new Decimal("10"))).toBe("10.000000");
    expect(toDbQuantityString(new Decimal("1.5"))).toBe("1.500000");
  });
});

describe("parseOptionalSignedDecimalInput", () => {
  it("parses blank input as undefined (absent)", () => {
    const result = parseOptionalSignedDecimalInput("");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value).toBeUndefined();
    }
  });

  it("accepts a positive delta", () => {
    const result = parseOptionalSignedDecimalInput("5");
    expect(result.success).toBe(true);
    if (result.success && result.value) {
      expect(result.value.toString()).toBe("5");
    }
  });

  it("accepts a negative delta", () => {
    const result = parseOptionalSignedDecimalInput("-5.5");
    expect(result.success).toBe(true);
    if (result.success && result.value) {
      expect(result.value.toString()).toBe("-5.5");
    }
  });

  it("rejects a zero delta (a correction that changes nothing is not a valid adjustment)", () => {
    const result = parseOptionalSignedDecimalInput("0");
    expect(result.success).toBe(false);
  });

  it("rejects malformed input", () => {
    const result = parseOptionalSignedDecimalInput("not-a-number");
    expect(result.success).toBe(false);
  });
});
