import { describe, expect, it } from "vitest";

import { Decimal } from "@/lib/money/decimal";
import { formatINR } from "@/lib/money/format";

describe("formatINR", () => {
  it("formats a whole-rupee Decimal with the INR symbol and Indian digit grouping", () => {
    expect(formatINR(new Decimal("100000"))).toBe("₹1,00,000.00");
  });

  it("formats a Decimal with paise", () => {
    expect(formatINR(new Decimal("1234.5"))).toBe("₹1,234.50");
  });

  it("accepts a plain string as well as a Decimal", () => {
    expect(formatINR("500")).toBe("₹500.00");
  });

  it("always renders exactly two fraction digits", () => {
    expect(formatINR(new Decimal("10.4999"))).toMatch(/^₹10\.5\d$/);
  });
});
