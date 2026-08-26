import { Decimal, type Money } from "@/lib/money/decimal";
import { RECONCILIATION_TOLERANCE } from "@/lib/bank-import/limits";
import type {
  ReconciliationSummary,
  RowDirection,
  RowDuplicateStatus,
  RowUserDecision,
  RowValidationError,
  StatementImportStatus,
} from "@/lib/bank-import/types";

/**
 * Pure arithmetic reconciliation — compares the statement's own declared
 * opening/closing balance against what was actually parsed and included,
 * using exactly the bank's own convention (a credit row always adds to
 * the statement's own running balance, a debit row always subtracts from
 * it), never a value this codebase invents. `status: "balanced"` is only
 * ever returned once the import has actually completed posting *and* the
 * numbers agree within RECONCILIATION_TOLERANCE — numeric agreement alone
 * is "in_progress" (a plan, not yet a posted fact), and a completed
 * import with no known opening/closing balance is "incomplete" rather than
 * a fabricated "balanced".
 */

export type ReconciliationRowInput = {
  userDecision: RowUserDecision;
  amount: Money | null;
  direction: RowDirection | null;
  duplicateStatus: RowDuplicateStatus;
  validationErrors: RowValidationError[];
};

export type ComputeReconciliationParams = {
  importStatus: StatementImportStatus;
  openingBalance: Money | null;
  closingBalance: Money | null;
  rows: ReconciliationRowInput[];
};

export function computeReconciliation(
  params: ComputeReconciliationParams,
): ReconciliationSummary {
  const { importStatus, openingBalance, closingBalance, rows } = params;

  let importedAmount = new Decimal(0);
  let excludedAmount = new Decimal(0);
  let matchedAmount = new Decimal(0);
  let netMovement = new Decimal(0);
  let invalidRowCount = 0;

  for (const row of rows) {
    if (row.validationErrors.length > 0) {
      invalidRowCount += 1;
    }
    if (!row.amount) {
      continue;
    }
    if (row.userDecision === "exclude") {
      excludedAmount = excludedAmount.plus(row.amount.abs());
      continue;
    }
    if (row.userDecision !== "include") {
      continue;
    }

    importedAmount = importedAmount.plus(row.amount.abs());
    if (row.duplicateStatus === "existing_transaction_match") {
      matchedAmount = matchedAmount.plus(row.amount.abs());
    }

    const signed =
      row.direction === "credit"
        ? row.amount.abs()
        : row.amount.abs().negated();
    netMovement = netMovement.plus(signed);
  }

  const expectedClosingBalance = openingBalance
    ? openingBalance.plus(netMovement)
    : null;
  const difference =
    closingBalance && expectedClosingBalance
      ? closingBalance.minus(expectedClosingBalance)
      : null;

  const tolerance = new Decimal(RECONCILIATION_TOLERANCE);

  let status: ReconciliationSummary["status"];
  if (!openingBalance && !closingBalance) {
    status = "not_started";
  } else if (!difference) {
    status = "incomplete";
  } else if (difference.abs().lessThanOrEqualTo(tolerance)) {
    status = importStatus === "completed" ? "balanced" : "in_progress";
  } else {
    status = "difference";
  }

  return {
    status,
    openingBalance,
    closingBalance,
    parsedNetMovement: netMovement,
    expectedClosingBalance,
    difference,
    importedAmount,
    matchedAmount,
    excludedAmount,
    invalidRowCount,
  };
}
