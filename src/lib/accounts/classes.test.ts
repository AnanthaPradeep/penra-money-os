import { describe, expect, it } from "vitest";

import {
  USER_ACCOUNT_TYPES,
  deriveAccountClass,
  isCreditCardType,
} from "@/lib/accounts/classes";

describe("deriveAccountClass", () => {
  it("classifies all asset-like account types as asset", () => {
    for (const type of [
      "bank_savings",
      "bank_current",
      "cash",
      "wallet",
      "other_asset",
    ] as const) {
      expect(deriveAccountClass(type)).toBe("asset");
    }
  });

  it("classifies all liability-like account types as liability", () => {
    for (const type of ["credit_card", "loan", "other_liability"] as const) {
      expect(deriveAccountClass(type)).toBe("liability");
    }
  });

  it("covers every user account type", () => {
    for (const type of USER_ACCOUNT_TYPES) {
      expect(["asset", "liability"]).toContain(deriveAccountClass(type));
    }
  });
});

describe("isCreditCardType", () => {
  it("returns true only for credit_card", () => {
    expect(isCreditCardType("credit_card")).toBe(true);
    expect(isCreditCardType("bank_savings")).toBe(false);
    expect(isCreditCardType("loan")).toBe(false);
  });
});
