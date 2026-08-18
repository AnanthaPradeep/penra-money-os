import { describe, expect, it } from "vitest";

import { Decimal } from "@/lib/money/decimal";
import { toDisplayBalance } from "@/lib/accounts/balance";

describe("toDisplayBalance", () => {
  it("shows an asset's display balance as-is (debit-normal)", () => {
    const result = toDisplayBalance("asset", new Decimal("10000"));
    expect(result.toString()).toBe("10000");
  });

  it("negates a liability's signed balance so a debt reads as a positive amount owed", () => {
    const result = toDisplayBalance("liability", new Decimal("-5000"));
    expect(result.toString()).toBe("5000");
  });

  it("negates a positive liability signed balance into a negative display (credit balance / overpayment)", () => {
    const result = toDisplayBalance("liability", new Decimal("200"));
    expect(result.toString()).toBe("-200");
  });

  it("leaves a zero balance unchanged for either class", () => {
    expect(toDisplayBalance("asset", new Decimal("0")).toString()).toBe("0");
    expect(toDisplayBalance("liability", new Decimal("0")).toString()).toBe(
      "0",
    );
  });
});
