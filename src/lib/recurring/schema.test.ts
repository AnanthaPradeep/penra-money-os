import { describe, expect, it } from "vitest";

import { recurringItemSchema } from "@/lib/recurring/schema";

const VALID_UUID_A = "11111111-1111-4111-8111-111111111111";
const VALID_UUID_B = "22222222-2222-4222-8222-222222222222";
const VALID_UUID_C = "33333333-3333-4333-8333-333333333333";

const SHARED = {
  name: "Test item",
  amount: "500",
  frequency: "monthly",
  intervalCount: "1",
  startDate: "2026-01-01",
  processingMode: "reminder_only",
};

describe("recurringItemSchema (discriminated union)", () => {
  it("accepts a valid bill", () => {
    const result = recurringItemSchema.safeParse({
      kind: "bill",
      sourceAccountId: VALID_UUID_A,
      categoryId: VALID_UUID_B,
      ...SHARED,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a bill missing its source account", () => {
    const result = recurringItemSchema.safeParse({
      kind: "bill",
      categoryId: VALID_UUID_B,
      ...SHARED,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a bill missing its category", () => {
    const result = recurringItemSchema.safeParse({
      kind: "bill",
      sourceAccountId: VALID_UUID_A,
      ...SHARED,
    });
    expect(result.success).toBe(false);
  });

  it("accepts a valid subscription with an optional trial end date", () => {
    const result = recurringItemSchema.safeParse({
      kind: "subscription",
      sourceAccountId: VALID_UUID_A,
      categoryId: VALID_UUID_B,
      trialEndDate: "2026-02-01",
      ...SHARED,
    });
    expect(result.success).toBe(true);
  });

  it("accepts a valid recurring income", () => {
    const result = recurringItemSchema.safeParse({
      kind: "income",
      destinationAccountId: VALID_UUID_A,
      categoryId: VALID_UUID_B,
      ...SHARED,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a recurring income missing its destination account", () => {
    const result = recurringItemSchema.safeParse({
      kind: "income",
      categoryId: VALID_UUID_B,
      ...SHARED,
    });
    expect(result.success).toBe(false);
  });

  it("accepts a valid recurring transfer between two different accounts", () => {
    const result = recurringItemSchema.safeParse({
      kind: "transfer",
      sourceAccountId: VALID_UUID_A,
      destinationAccountId: VALID_UUID_B,
      ...SHARED,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a recurring transfer to and from the same account", () => {
    const result = recurringItemSchema.safeParse({
      kind: "transfer",
      sourceAccountId: VALID_UUID_A,
      destinationAccountId: VALID_UUID_A,
      ...SHARED,
    });
    expect(result.success).toBe(false);
  });

  it("strips a stray category field from a transfer's parsed output (transfers never have one)", () => {
    const result = recurringItemSchema.safeParse({
      kind: "transfer",
      sourceAccountId: VALID_UUID_A,
      destinationAccountId: VALID_UUID_B,
      categoryId: VALID_UUID_C,
      ...SHARED,
    });
    // categoryId is simply an unrecognized key for the transfer branch of
    // the discriminated union — Zod ignores it rather than rejecting,
    // since the transfer schema never declares that field. The important
    // guarantee is that the parsed *output* never carries it through.
    expect(result.success).toBe(true);
    if (result.success && result.data.kind === "transfer") {
      expect("categoryId" in result.data).toBe(false);
    }
  });

  it("rejects an unrecognized kind", () => {
    const result = recurringItemSchema.safeParse({
      kind: "not-a-real-kind",
      ...SHARED,
    });
    expect(result.success).toBe(false);
  });

  it("rejects an end date before the start date", () => {
    const result = recurringItemSchema.safeParse({
      kind: "bill",
      sourceAccountId: VALID_UUID_A,
      categoryId: VALID_UUID_B,
      endDate: "2025-12-31",
      ...SHARED,
    });
    expect(result.success).toBe(false);
  });

  it("accepts an end date on or after the start date", () => {
    const result = recurringItemSchema.safeParse({
      kind: "bill",
      sourceAccountId: VALID_UUID_A,
      categoryId: VALID_UUID_B,
      endDate: "2026-06-01",
      ...SHARED,
    });
    expect(result.success).toBe(true);
  });

  it("rejects an interval count of zero", () => {
    const result = recurringItemSchema.safeParse({
      kind: "bill",
      sourceAccountId: VALID_UUID_A,
      categoryId: VALID_UUID_B,
      ...SHARED,
      intervalCount: "0",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an unsupported frequency", () => {
    const result = recurringItemSchema.safeParse({
      kind: "bill",
      sourceAccountId: VALID_UUID_A,
      categoryId: VALID_UUID_B,
      ...SHARED,
      frequency: "daily",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a non-positive amount", () => {
    const result = recurringItemSchema.safeParse({
      kind: "bill",
      sourceAccountId: VALID_UUID_A,
      categoryId: VALID_UUID_B,
      ...SHARED,
      amount: "0",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an unsupported processing mode", () => {
    const result = recurringItemSchema.safeParse({
      kind: "bill",
      sourceAccountId: VALID_UUID_A,
      categoryId: VALID_UUID_B,
      ...SHARED,
      processingMode: "auto_magic",
    });
    expect(result.success).toBe(false);
  });

  it("requires processingMode explicitly (no silent default at the schema layer)", () => {
    const { processingMode: _processingMode, ...sharedWithoutMode } = SHARED;
    const result = recurringItemSchema.safeParse({
      kind: "bill",
      sourceAccountId: VALID_UUID_A,
      categoryId: VALID_UUID_B,
      ...sharedWithoutMode,
    });
    expect(result.success).toBe(false);
  });
});
