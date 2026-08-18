import { describe, expect, it } from "vitest";

import { accountFormSchema } from "@/lib/accounts/schema";

const VALID_ACCOUNT = {
  name: "HDFC Savings",
  accountType: "bank_savings",
};

describe("accountFormSchema", () => {
  it("accepts a minimal valid account", () => {
    const result = accountFormSchema.safeParse(VALID_ACCOUNT);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.currency).toBe("INR");
      expect(result.data.institutionId).toBeUndefined();
      expect(result.data.creditLimit).toBeUndefined();
      expect(result.data.openingBalance).toBeUndefined();
    }
  });

  it("rejects a blank name", () => {
    const result = accountFormSchema.safeParse({
      ...VALID_ACCOUNT,
      name: "  ",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an unrecognised account type", () => {
    const result = accountFormSchema.safeParse({
      ...VALID_ACCOUNT,
      accountType: "bitcoin_wallet",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a valid 4-digit last-four", () => {
    const result = accountFormSchema.safeParse({
      ...VALID_ACCOUNT,
      lastFour: "1234",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a last-four that is not exactly 4 digits", () => {
    const result = accountFormSchema.safeParse({
      ...VALID_ACCOUNT,
      lastFour: "12345",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a last-four containing non-digit characters", () => {
    const result = accountFormSchema.safeParse({
      ...VALID_ACCOUNT,
      lastFour: "12ab",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a credit limit for a credit_card account", () => {
    const result = accountFormSchema.safeParse({
      name: "ICICI Platinum",
      accountType: "credit_card",
      creditLimit: "50000",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.creditLimit?.toString()).toBe("50000");
    }
  });

  it("rejects a credit limit on a non-credit-card account", () => {
    const result = accountFormSchema.safeParse({
      ...VALID_ACCOUNT,
      creditLimit: "50000",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid institutionId", () => {
    const result = accountFormSchema.safeParse({
      ...VALID_ACCOUNT,
      institutionId: "not-a-uuid",
    });
    expect(result.success).toBe(false);
  });

  it("accepts an opening balance amount", () => {
    const result = accountFormSchema.safeParse({
      ...VALID_ACCOUNT,
      openingBalance: "1000.50",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.openingBalance?.toString()).toBe("1000.5");
    }
  });

  it("rejects notes over 2000 characters", () => {
    const result = accountFormSchema.safeParse({
      ...VALID_ACCOUNT,
      notes: "a".repeat(2001),
    });
    expect(result.success).toBe(false);
  });
});
