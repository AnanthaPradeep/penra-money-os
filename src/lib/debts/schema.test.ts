import { describe, expect, it } from "vitest";

import { createDebtSchema, recordDebtPaymentSchema } from "@/lib/debts/schema";

const ACCOUNT_A = "11111111-1111-4111-8111-111111111111";
const IDEMPOTENCY_KEY = "44444444-4444-4444-8444-444444444444";

describe("createDebtSchema", () => {
  const base = {
    name: "Home loan",
    debtType: "home_loan",
    liabilityAccountId: ACCOUNT_A,
    originalPrincipal: "2000000",
    startDate: "2026-01-01",
    currency: "INR",
    annualInterestRate: "8.5",
  };

  it("accepts a valid debt", () => {
    expect(createDebtSchema.safeParse(base).success).toBe(true);
  });

  it("defaults the interest rate to zero when omitted", () => {
    const { annualInterestRate: _omit, ...withoutRate } = base;
    const result = createDebtSchema.safeParse(withoutRate);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.annualInterestRate.toString()).toBe("0");
    }
  });

  it("rejects a rate above 100%", () => {
    const result = createDebtSchema.safeParse({
      ...base,
      annualInterestRate: "150",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a contractual end date before the start date", () => {
    const result = createDebtSchema.safeParse({
      ...base,
      contractualEndDate: "2025-01-01",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a contractual end date on or after the start date", () => {
    const result = createDebtSchema.safeParse({
      ...base,
      contractualEndDate: "2036-01-01",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a due day outside 1-31", () => {
    const result = createDebtSchema.safeParse({ ...base, dueDay: "45" });
    expect(result.success).toBe(false);
  });
});

describe("recordDebtPaymentSchema", () => {
  const base = {
    principalAmount: "1000",
    interestAmount: "200",
    feesAmount: "0",
    paymentAccountId: ACCOUNT_A,
    effectiveDate: "2026-01-01",
    idempotencyKey: IDEMPOTENCY_KEY,
  };

  it("accepts a payment with a positive principal and interest", () => {
    expect(recordDebtPaymentSchema.safeParse(base).success).toBe(true);
  });

  it("accepts an interest-only payment (zero principal)", () => {
    const result = recordDebtPaymentSchema.safeParse({
      ...base,
      principalAmount: "0",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a payment where every component is zero", () => {
    const result = recordDebtPaymentSchema.safeParse({
      ...base,
      principalAmount: "0",
      interestAmount: "0",
      feesAmount: "0",
    });
    expect(result.success).toBe(false);
  });
});
