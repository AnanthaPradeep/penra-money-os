import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  creditCardPaymentSchema,
  creditCardPurchaseSchema,
  expenseTransactionSchema,
  incomeTransactionSchema,
  transferTransactionSchema,
} from "@/lib/ledger/schema";

const VALID_UUID_A = "11111111-1111-4111-8111-111111111111";
const VALID_UUID_B = "22222222-2222-4222-8222-222222222222";
const VALID_CATEGORY_ID = "33333333-3333-4333-8333-333333333333";
const VALID_IDEMPOTENCY_KEY = "44444444-4444-4444-8444-444444444444";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-08-16T10:00:00.000Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("incomeTransactionSchema", () => {
  const VALID = {
    toAccountId: VALID_UUID_A,
    categoryId: VALID_CATEGORY_ID,
    amount: "50000",
    occurredOn: "2026-08-16",
    description: "Salary",
    idempotencyKey: VALID_IDEMPOTENCY_KEY,
  };

  it("accepts a valid income transaction", () => {
    expect(incomeTransactionSchema.safeParse(VALID).success).toBe(true);
  });

  it("rejects an invalid account id", () => {
    const result = incomeTransactionSchema.safeParse({
      ...VALID,
      toAccountId: "not-a-uuid",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a future date", () => {
    const result = incomeTransactionSchema.safeParse({
      ...VALID,
      occurredOn: "2026-08-17",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid amount", () => {
    const result = incomeTransactionSchema.safeParse({ ...VALID, amount: "0" });
    expect(result.success).toBe(false);
  });

  it("rejects a blank description", () => {
    const result = incomeTransactionSchema.safeParse({
      ...VALID,
      description: "",
    });
    expect(result.success).toBe(false);
  });
});

describe("expenseTransactionSchema", () => {
  it("accepts a valid expense transaction", () => {
    const result = expenseTransactionSchema.safeParse({
      fromAccountId: VALID_UUID_A,
      categoryId: VALID_CATEGORY_ID,
      amount: "1200.5",
      occurredOn: "2026-08-16",
      description: "Groceries",
      idempotencyKey: VALID_IDEMPOTENCY_KEY,
    });
    expect(result.success).toBe(true);
  });
});

describe("transferTransactionSchema", () => {
  const VALID = {
    fromAccountId: VALID_UUID_A,
    toAccountId: VALID_UUID_B,
    amount: "2000",
    occurredOn: "2026-08-16",
    description: "Move to savings",
    idempotencyKey: VALID_IDEMPOTENCY_KEY,
  };

  it("accepts a valid transfer between two different accounts", () => {
    expect(transferTransactionSchema.safeParse(VALID).success).toBe(true);
  });

  it("rejects a transfer to and from the same account", () => {
    const result = transferTransactionSchema.safeParse({
      ...VALID,
      toAccountId: VALID_UUID_A,
    });
    expect(result.success).toBe(false);
  });
});

describe("creditCardPurchaseSchema", () => {
  it("accepts a valid credit card purchase", () => {
    const result = creditCardPurchaseSchema.safeParse({
      creditCardAccountId: VALID_UUID_A,
      categoryId: VALID_CATEGORY_ID,
      amount: "999.99",
      occurredOn: "2026-08-16",
      description: "Online order",
      idempotencyKey: VALID_IDEMPOTENCY_KEY,
    });
    expect(result.success).toBe(true);
  });
});

describe("creditCardPaymentSchema", () => {
  const VALID = {
    creditCardAccountId: VALID_UUID_A,
    fromAccountId: VALID_UUID_B,
    amount: "5000",
    occurredOn: "2026-08-16",
    description: "Card payment",
    idempotencyKey: VALID_IDEMPOTENCY_KEY,
  };

  it("accepts a valid credit card payment from a different account", () => {
    expect(creditCardPaymentSchema.safeParse(VALID).success).toBe(true);
  });

  it("rejects paying a credit card from itself", () => {
    const result = creditCardPaymentSchema.safeParse({
      ...VALID,
      fromAccountId: VALID_UUID_A,
    });
    expect(result.success).toBe(false);
  });
});
