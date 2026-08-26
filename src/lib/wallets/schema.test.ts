import { describe, expect, it } from "vitest";

import {
  createPurposeWalletSchema,
  incomeAllocationPlanSchema,
  walletReallocationSchema,
} from "@/lib/wallets/schema";

const WALLET_A = "11111111-1111-4111-8111-111111111111";
const WALLET_B = "22222222-2222-4222-8222-222222222222";
const WALLET_C = "33333333-3333-4333-8333-333333333333";

describe("createPurposeWalletSchema", () => {
  it("accepts a minimal valid wallet", () => {
    const result = createPurposeWalletSchema.safeParse({
      name: "Groceries",
      currency: "INR",
      priority: "0",
      fundingMode: "earmarked",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a blank name", () => {
    const result = createPurposeWalletSchema.safeParse({
      name: "  ",
      currency: "INR",
      priority: "0",
      fundingMode: "earmarked",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid hex color", () => {
    const result = createPurposeWalletSchema.safeParse({
      name: "Travel",
      currency: "INR",
      color: "blue",
      priority: "0",
      fundingMode: "earmarked",
    });
    expect(result.success).toBe(false);
  });
});

describe("walletReallocationSchema", () => {
  it("rejects moving money between the same wallet twice", () => {
    const result = walletReallocationSchema.safeParse({
      fromWalletId: WALLET_A,
      toWalletId: WALLET_A,
      amount: "100",
    });
    expect(result.success).toBe(false);
  });

  it("accepts two different wallets", () => {
    const result = walletReallocationSchema.safeParse({
      fromWalletId: WALLET_A,
      toWalletId: WALLET_B,
      amount: "100",
    });
    expect(result.success).toBe(true);
  });
});

describe("incomeAllocationPlanSchema", () => {
  const base = {
    name: "Salary split",
    effectiveDate: "2026-01-01",
  };

  it("accepts percentage lines that total exactly 100", () => {
    const result = incomeAllocationPlanSchema.safeParse({
      ...base,
      allocationMode: "percentage",
      lines: [
        { walletId: WALLET_A, percentage: "60" },
        { walletId: WALLET_B, percentage: "40" },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects percentage lines that total under 100", () => {
    const result = incomeAllocationPlanSchema.safeParse({
      ...base,
      allocationMode: "percentage",
      lines: [
        { walletId: WALLET_A, percentage: "60" },
        { walletId: WALLET_B, percentage: "30" },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects percentage lines that total over 100", () => {
    const result = incomeAllocationPlanSchema.safeParse({
      ...base,
      allocationMode: "percentage",
      lines: [
        { walletId: WALLET_A, percentage: "60" },
        { walletId: WALLET_B, percentage: "50" },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("never silently normalizes an off-100 percentage total — it's a hard rejection, not a rescale", () => {
    const result = incomeAllocationPlanSchema.safeParse({
      ...base,
      allocationMode: "percentage",
      lines: [{ walletId: WALLET_A, percentage: "99" }],
    });
    expect(result.success).toBe(false);
  });

  it("accepts a fixed_amount plan with no percentage totals to validate", () => {
    const result = incomeAllocationPlanSchema.safeParse({
      ...base,
      allocationMode: "fixed_amount",
      lines: [
        { walletId: WALLET_A, fixedAmount: "5000" },
        { walletId: WALLET_B, fixedAmount: "3000" },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects a fixed_amount plan that mixes in a percentage line", () => {
    const result = incomeAllocationPlanSchema.safeParse({
      ...base,
      allocationMode: "fixed_amount",
      lines: [
        { walletId: WALLET_A, fixedAmount: "5000" },
        { walletId: WALLET_B, percentage: "10" },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("accepts a hybrid plan mixing fixed and percentage lines that total 100", () => {
    const result = incomeAllocationPlanSchema.safeParse({
      ...base,
      allocationMode: "hybrid",
      lines: [
        { walletId: WALLET_A, fixedAmount: "2000" },
        { walletId: WALLET_B, percentage: "50" },
        { walletId: WALLET_C, percentage: "50" },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects a plan with no lines at all", () => {
    const result = incomeAllocationPlanSchema.safeParse({
      ...base,
      allocationMode: "manual",
      lines: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a line with neither a percentage nor a fixed amount", () => {
    const result = incomeAllocationPlanSchema.safeParse({
      ...base,
      allocationMode: "manual",
      lines: [{ walletId: WALLET_A }],
    });
    expect(result.success).toBe(false);
  });
});
