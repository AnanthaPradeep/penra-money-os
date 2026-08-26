import { describe, expect, it } from "vitest";

import {
  createFinancialGoalSchema,
  goalContributionTransferSchema,
} from "@/lib/goals/schema";

const ACCOUNT_A = "11111111-1111-4111-8111-111111111111";
const ACCOUNT_B = "22222222-2222-4222-8222-222222222222";
const IDEMPOTENCY_KEY = "44444444-4444-4444-8444-444444444444";

describe("createFinancialGoalSchema", () => {
  const base = {
    name: "Emergency fund",
    goalType: "emergency_fund",
    currency: "INR",
    targetAmount: "50000",
    priority: "0",
    fundingMode: "earmarked",
  };

  it("accepts a valid goal with no target date", () => {
    expect(createFinancialGoalSchema.safeParse(base).success).toBe(true);
  });

  it("accepts a target date on or after the start date", () => {
    const result = createFinancialGoalSchema.safeParse({
      ...base,
      startDate: "2026-01-01",
      targetDate: "2026-06-01",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a target date before the start date", () => {
    const result = createFinancialGoalSchema.safeParse({
      ...base,
      startDate: "2026-06-01",
      targetDate: "2026-01-01",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a zero target amount", () => {
    const result = createFinancialGoalSchema.safeParse({
      ...base,
      targetAmount: "0",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown goal type", () => {
    const result = createFinancialGoalSchema.safeParse({
      ...base,
      goalType: "yacht",
    });
    expect(result.success).toBe(false);
  });
});

describe("goalContributionTransferSchema", () => {
  const base = {
    fromAccountId: ACCOUNT_A,
    toAccountId: ACCOUNT_B,
    amount: "1000",
    occurredOn: "2026-01-01",
    idempotencyKey: IDEMPOTENCY_KEY,
  };

  it("accepts two different accounts", () => {
    expect(goalContributionTransferSchema.safeParse(base).success).toBe(true);
  });

  it("rejects the same account on both sides", () => {
    const result = goalContributionTransferSchema.safeParse({
      ...base,
      toAccountId: ACCOUNT_A,
    });
    expect(result.success).toBe(false);
  });
});
