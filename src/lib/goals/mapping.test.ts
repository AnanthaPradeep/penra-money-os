import { describe, expect, it } from "vitest";

import { Decimal } from "@/lib/money/decimal";
import { goalFundedAmount, type GoalContribution } from "@/lib/goals/mapping";

function contribution(
  overrides: Partial<GoalContribution> = {},
): GoalContribution {
  return {
    id: "c1",
    goalId: "g1",
    contributionType: "allocation_only",
    direction: "contribution",
    amount: new Decimal("1000"),
    currency: "INR",
    fromAccountId: null,
    toAccountId: null,
    relatedTransactionId: null,
    status: "recorded",
    occurredAt: "2026-01-01T00:00:00.000Z",
    notes: null,
    ...overrides,
  };
}

describe("goalFundedAmount", () => {
  it("returns zero for no contributions", () => {
    expect(goalFundedAmount([]).toString()).toBe("0");
  });

  it("sums contributions", () => {
    const total = goalFundedAmount([
      contribution({ amount: new Decimal("1000") }),
      contribution({ amount: new Decimal("500") }),
    ]);
    expect(total.toString()).toBe("1500");
  });

  it("subtracts withdrawals from contributions", () => {
    const total = goalFundedAmount([
      contribution({ amount: new Decimal("1000"), direction: "contribution" }),
      contribution({ amount: new Decimal("300"), direction: "withdrawal" }),
    ]);
    expect(total.toString()).toBe("700");
  });

  it("excludes reversed contributions entirely", () => {
    const total = goalFundedAmount([
      contribution({ amount: new Decimal("1000"), status: "recorded" }),
      contribution({ amount: new Decimal("500"), status: "reversed" }),
    ]);
    expect(total.toString()).toBe("1000");
  });
});
