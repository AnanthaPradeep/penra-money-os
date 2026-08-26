import { describe, expect, it } from "vitest";

import { evaluateImportRules } from "@/lib/bank-import/rules";
import type { ImportRule } from "@/lib/bank-import/mapping";
import { Decimal } from "@/lib/money/decimal";

function rule(overrides: Partial<ImportRule> = {}): ImportRule {
  return {
    id: overrides.id ?? "rule-1",
    name: "Test rule",
    matchField: "description_contains",
    matchValue: "swiggy",
    directionFilter: null,
    accountId: null,
    minAmount: null,
    maxAmount: null,
    suggestedTransactionType: "expense",
    suggestedCategoryId: "cat-food",
    suggestedPayeeId: null,
    notesTemplate: null,
    exclude: false,
    priority: 0,
    isActive: true,
    ...overrides,
  };
}

function row(
  overrides: Partial<Parameters<typeof evaluateImportRules>[0]> = {},
) {
  return {
    description: "SWIGGY ORDER 12345",
    reference: null,
    direction: "debit" as const,
    accountId: "acct-1",
    amount: new Decimal("450.00"),
    ...overrides,
  };
}

describe("evaluateImportRules", () => {
  it("matches a description_contains rule case-insensitively", () => {
    const result = evaluateImportRules(row(), [rule()]);
    expect(result).toEqual({ status: "matched", rule: rule() });
  });

  it("returns no_match when nothing matches", () => {
    const result = evaluateImportRules(row({ description: "Rent payment" }), [
      rule(),
    ]);
    expect(result.status).toBe("no_match");
  });

  it("matches description_starts_with", () => {
    const startsWithRule = rule({
      id: "rule-starts",
      matchField: "description_starts_with",
      matchValue: "swiggy",
    });
    const result = evaluateImportRules(row(), [startsWithRule]);
    expect(result.status).toBe("matched");
  });

  it("does not match description_starts_with when the value is mid-string", () => {
    const startsWithRule = rule({
      matchField: "description_starts_with",
      matchValue: "order",
    });
    const result = evaluateImportRules(row(), [startsWithRule]);
    expect(result.status).toBe("no_match");
  });

  it("matches description_exact only on an exact normalized match", () => {
    const exactRule = rule({
      matchField: "description_exact",
      matchValue: "swiggy order 12345",
    });
    expect(evaluateImportRules(row(), [exactRule]).status).toBe("matched");
    expect(
      evaluateImportRules(row({ description: "SWIGGY ORDER 12345 " }), [
        exactRule,
      ]).status,
    ).toBe("matched");
    expect(
      evaluateImportRules(row({ description: "swiggy order 123456" }), [
        exactRule,
      ]).status,
    ).toBe("no_match");
  });

  it("matches reference_prefix", () => {
    const refRule = rule({ matchField: "reference_prefix", matchValue: "UTR" });
    const result = evaluateImportRules(row({ reference: "UTR998877" }), [
      refRule,
    ]);
    expect(result.status).toBe("matched");
  });

  it("does not match reference_prefix when reference is null", () => {
    const refRule = rule({ matchField: "reference_prefix", matchValue: "UTR" });
    const result = evaluateImportRules(row({ reference: null }), [refRule]);
    expect(result.status).toBe("no_match");
  });

  it("respects the direction filter", () => {
    const debitOnly = rule({ directionFilter: "debit" });
    expect(
      evaluateImportRules(row({ direction: "debit" }), [debitOnly]).status,
    ).toBe("matched");
    expect(
      evaluateImportRules(row({ direction: "credit" }), [debitOnly]).status,
    ).toBe("no_match");
  });

  it("respects the account filter", () => {
    const scoped = rule({ accountId: "acct-2" });
    expect(
      evaluateImportRules(row({ accountId: "acct-1" }), [scoped]).status,
    ).toBe("no_match");
    expect(
      evaluateImportRules(row({ accountId: "acct-2" }), [scoped]).status,
    ).toBe("matched");
  });

  it("respects the amount range filter", () => {
    const ranged = rule({
      minAmount: new Decimal("500"),
      maxAmount: new Decimal("1000"),
    });
    expect(
      evaluateImportRules(row({ amount: new Decimal("450") }), [ranged]).status,
    ).toBe("no_match");
    expect(
      evaluateImportRules(row({ amount: new Decimal("600") }), [ranged]).status,
    ).toBe("matched");
  });

  it("ignores an inactive rule", () => {
    const inactive = rule({ isActive: false });
    expect(evaluateImportRules(row(), [inactive]).status).toBe("no_match");
  });

  it("picks the highest-priority rule when multiple match and agree", () => {
    const low = rule({
      id: "low",
      priority: 0,
      suggestedCategoryId: "cat-food",
    });
    const high = rule({
      id: "high",
      priority: 10,
      suggestedCategoryId: "cat-food",
    });
    const result = evaluateImportRules(row(), [low, high]);
    expect(result).toEqual({ status: "matched", rule: high });
  });

  it("reports a conflict when two same-priority rules disagree", () => {
    const a = rule({ id: "a", priority: 5, suggestedCategoryId: "cat-food" });
    const b = rule({ id: "b", priority: 5, suggestedCategoryId: "cat-dining" });
    const result = evaluateImportRules(row(), [a, b]);
    expect(result.status).toBe("conflict");
    if (result.status === "conflict") {
      expect(result.rules).toHaveLength(2);
    }
  });

  it("does not report a conflict when two same-priority rules agree on everything", () => {
    const a = rule({ id: "a", priority: 5 });
    const b = rule({ id: "b", priority: 5 });
    const result = evaluateImportRules(row(), [a, b]);
    expect(result.status).toBe("matched");
  });

  it("an exclude rule is reflected in the matched rule", () => {
    const excludeRule = rule({ exclude: true, suggestedCategoryId: null });
    const result = evaluateImportRules(row(), [excludeRule]);
    expect(result).toEqual({ status: "matched", rule: excludeRule });
  });
});
