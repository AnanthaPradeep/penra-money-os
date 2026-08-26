import { describe, expect, it } from "vitest";

import {
  computeReconciliation,
  type ReconciliationRowInput,
} from "@/lib/bank-import/reconciliation";
import { Decimal } from "@/lib/money/decimal";

function includedRow(
  amount: string,
  direction: "debit" | "credit",
  overrides: Partial<ReconciliationRowInput> = {},
): ReconciliationRowInput {
  return {
    userDecision: "include",
    amount: new Decimal(amount),
    direction,
    duplicateStatus: "not_duplicate",
    validationErrors: [],
    ...overrides,
  };
}

describe("computeReconciliation", () => {
  it("returns not_started when neither balance is known", () => {
    const result = computeReconciliation({
      importStatus: "reviewing",
      openingBalance: null,
      closingBalance: null,
      rows: [],
    });
    expect(result.status).toBe("not_started");
  });

  it("returns incomplete when only the opening balance is known", () => {
    const result = computeReconciliation({
      importStatus: "reviewing",
      openingBalance: new Decimal("1000"),
      closingBalance: null,
      rows: [],
    });
    expect(result.status).toBe("incomplete");
  });

  it("computes expected closing as opening plus net movement", () => {
    const result = computeReconciliation({
      importStatus: "completed",
      openingBalance: new Decimal("1000"),
      closingBalance: new Decimal("1300"),
      rows: [includedRow("500", "credit"), includedRow("200", "debit")],
    });
    expect(result.parsedNetMovement?.toString()).toBe("300");
    expect(result.expectedClosingBalance?.toString()).toBe("1300");
    expect(result.difference?.toString()).toBe("0");
  });

  it("marks balanced only once the import has completed, not merely because the numbers agree", () => {
    const params = {
      openingBalance: new Decimal("1000"),
      closingBalance: new Decimal("1300"),
      rows: [includedRow("500", "credit"), includedRow("200", "debit")],
    };
    const beforePosting = computeReconciliation({
      importStatus: "ready",
      ...params,
    });
    const afterPosting = computeReconciliation({
      importStatus: "completed",
      ...params,
    });
    expect(beforePosting.status).toBe("in_progress");
    expect(afterPosting.status).toBe("balanced");
  });

  it("flags a genuine difference beyond tolerance", () => {
    const result = computeReconciliation({
      importStatus: "completed",
      openingBalance: new Decimal("1000"),
      closingBalance: new Decimal("1400"),
      rows: [includedRow("500", "credit"), includedRow("200", "debit")],
    });
    expect(result.status).toBe("difference");
    expect(result.difference?.toString()).toBe("100");
  });

  it("tolerates a sub-paisa rounding artifact as balanced", () => {
    const result = computeReconciliation({
      importStatus: "completed",
      openingBalance: new Decimal("1000"),
      closingBalance: new Decimal("1300.005"),
      rows: [includedRow("500", "credit"), includedRow("200", "debit")],
    });
    expect(result.status).toBe("balanced");
  });

  it("never fabricates a balanced status when a closing balance is absent, even after completion", () => {
    const result = computeReconciliation({
      importStatus: "completed",
      openingBalance: new Decimal("1000"),
      closingBalance: null,
      rows: [includedRow("500", "credit")],
    });
    expect(result.status).toBe("incomplete");
  });

  it("excludes excluded rows from imported/net-movement totals", () => {
    const result = computeReconciliation({
      importStatus: "reviewing",
      openingBalance: null,
      closingBalance: null,
      rows: [
        includedRow("500", "credit"),
        includedRow("200", "debit", { userDecision: "exclude" }),
      ],
    });
    expect(result.importedAmount.toString()).toBe("500");
    expect(result.excludedAmount.toString()).toBe("200");
    expect(result.parsedNetMovement.toString()).toBe("500");
  });

  it("counts matched (existing-transaction) amounts separately", () => {
    const result = computeReconciliation({
      importStatus: "reviewing",
      openingBalance: null,
      closingBalance: null,
      rows: [
        includedRow("500", "credit", {
          duplicateStatus: "existing_transaction_match",
        }),
        includedRow("100", "debit"),
      ],
    });
    expect(result.matchedAmount.toString()).toBe("500");
    expect(result.importedAmount.toString()).toBe("600");
  });

  it("counts invalid rows regardless of decision", () => {
    const result = computeReconciliation({
      importStatus: "reviewing",
      openingBalance: null,
      closingBalance: null,
      rows: [
        includedRow("500", "credit", {
          validationErrors: [{ code: "missing_date", message: "x" }],
        }),
        includedRow("100", "debit"),
      ],
    });
    expect(result.invalidRowCount).toBe(1);
  });

  it("ignores pending (undecided) rows in imported/excluded totals", () => {
    const result = computeReconciliation({
      importStatus: "reviewing",
      openingBalance: null,
      closingBalance: null,
      rows: [includedRow("500", "credit", { userDecision: "pending" })],
    });
    expect(result.importedAmount.toString()).toBe("0");
    expect(result.excludedAmount.toString()).toBe("0");
  });
});
