import { describe, expect, it } from "vitest";

import {
  investmentActivitySchema,
  investmentAssetSchema,
  manualValuationSchema,
} from "@/lib/investments/schema";

const ACCOUNT = "11111111-1111-4111-8111-111111111111";
const CATEGORY = "22222222-2222-4222-8222-222222222222";
const KEY = "33333333-3333-4333-8333-333333333333";
const PAST_DATE = "2020-01-01";

describe("investmentActivitySchema (discriminated union)", () => {
  it("accepts a valid buy", () => {
    const result = investmentActivitySchema.safeParse({
      activityKind: "buy",
      fundingAccountId: ACCOUNT,
      tradeDate: PAST_DATE,
      quantity: "10",
      unitPrice: "100",
      idempotencyKey: KEY,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a buy with zero quantity", () => {
    const result = investmentActivitySchema.safeParse({
      activityKind: "buy",
      fundingAccountId: ACCOUNT,
      tradeDate: PAST_DATE,
      quantity: "0",
      unitPrice: "100",
      idempotencyKey: KEY,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a buy with a negative unit price", () => {
    const result = investmentActivitySchema.safeParse({
      activityKind: "buy",
      fundingAccountId: ACCOUNT,
      tradeDate: PAST_DATE,
      quantity: "10",
      unitPrice: "-5",
      idempotencyKey: KEY,
    });
    expect(result.success).toBe(false);
  });

  it("accepts a valid sell with fee and tax", () => {
    const result = investmentActivitySchema.safeParse({
      activityKind: "sell",
      receivingAccountId: ACCOUNT,
      tradeDate: PAST_DATE,
      quantity: "5",
      unitPrice: "150",
      feeAmount: "10",
      taxAmount: "2",
      idempotencyKey: KEY,
    });
    expect(result.success).toBe(true);
  });

  it("accepts a valid contribution with no quantity/price", () => {
    const result = investmentActivitySchema.safeParse({
      activityKind: "contribution",
      fundingAccountId: ACCOUNT,
      tradeDate: PAST_DATE,
      grossAmount: "50000",
      idempotencyKey: KEY,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a contribution missing its funding account", () => {
    const result = investmentActivitySchema.safeParse({
      activityKind: "contribution",
      tradeDate: PAST_DATE,
      grossAmount: "50000",
      idempotencyKey: KEY,
    });
    expect(result.success).toBe(false);
  });

  it("accepts a valid withdrawal", () => {
    const result = investmentActivitySchema.safeParse({
      activityKind: "withdrawal",
      receivingAccountId: ACCOUNT,
      tradeDate: PAST_DATE,
      grossAmount: "1000",
      idempotencyKey: KEY,
    });
    expect(result.success).toBe(true);
  });

  it("accepts a valid dividend with an income category", () => {
    const result = investmentActivitySchema.safeParse({
      activityKind: "dividend",
      receivingAccountId: ACCOUNT,
      tradeDate: PAST_DATE,
      grossAmount: "250",
      categoryId: CATEGORY,
      idempotencyKey: KEY,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a dividend missing its category", () => {
    const result = investmentActivitySchema.safeParse({
      activityKind: "dividend",
      receivingAccountId: ACCOUNT,
      tradeDate: PAST_DATE,
      grossAmount: "250",
      idempotencyKey: KEY,
    });
    expect(result.success).toBe(false);
  });

  it("accepts a valid interest activity", () => {
    const result = investmentActivitySchema.safeParse({
      activityKind: "interest",
      receivingAccountId: ACCOUNT,
      tradeDate: PAST_DATE,
      grossAmount: "500",
      categoryId: CATEGORY,
      idempotencyKey: KEY,
    });
    expect(result.success).toBe(true);
  });

  it("accepts a valid standalone fee with no category (optional)", () => {
    const result = investmentActivitySchema.safeParse({
      activityKind: "fee",
      fundingAccountId: ACCOUNT,
      tradeDate: PAST_DATE,
      grossAmount: "50",
      idempotencyKey: KEY,
    });
    expect(result.success).toBe(true);
  });

  it("accepts a valid adjustment with a quantity delta and sufficient explanation", () => {
    const result = investmentActivitySchema.safeParse({
      activityKind: "adjustment",
      tradeDate: PAST_DATE,
      notes: "Correcting a data-entry mistake from the initial import.",
      quantityDelta: "5",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an adjustment with too short an explanation", () => {
    const result = investmentActivitySchema.safeParse({
      activityKind: "adjustment",
      tradeDate: PAST_DATE,
      notes: "oops",
      quantityDelta: "5",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an adjustment with neither a quantity nor cost-basis delta", () => {
    const result = investmentActivitySchema.safeParse({
      activityKind: "adjustment",
      tradeDate: PAST_DATE,
      notes: "Correcting a data-entry mistake from the initial import.",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a negative adjustment delta", () => {
    const result = investmentActivitySchema.safeParse({
      activityKind: "adjustment",
      tradeDate: PAST_DATE,
      notes: "Correcting a data-entry mistake from the initial import.",
      costBasisDelta: "-100",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an unrecognized activityKind", () => {
    const result = investmentActivitySchema.safeParse({
      activityKind: "not-a-real-kind",
      tradeDate: PAST_DATE,
    });
    expect(result.success).toBe(false);
  });
});

describe("investmentAssetSchema", () => {
  it("accepts a minimal valid stock asset", () => {
    const result = investmentAssetSchema.safeParse({
      assetKind: "stock",
      displayName: "HDFC Bank",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a blank display name", () => {
    const result = investmentAssetSchema.safeParse({
      assetKind: "stock",
      displayName: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an unrecognized asset kind", () => {
    const result = investmentAssetSchema.safeParse({
      assetKind: "crypto",
      displayName: "Bitcoin",
    });
    expect(result.success).toBe(false);
  });
});

describe("manualValuationSchema", () => {
  it("accepts a valid valuation with only a total value", () => {
    const result = manualValuationSchema.safeParse({
      valuedAt: PAST_DATE,
      totalValue: "5500",
    });
    expect(result.success).toBe(true);
  });

  it("accepts zero as a valid total value (a fully-lost or unheld position)", () => {
    const result = manualValuationSchema.safeParse({
      valuedAt: PAST_DATE,
      totalValue: "0",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a future valuation date", () => {
    const result = manualValuationSchema.safeParse({
      valuedAt: "2099-01-01",
      totalValue: "5500",
    });
    expect(result.success).toBe(false);
  });
});
