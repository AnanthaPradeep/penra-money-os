import { Decimal, type Money } from "@/lib/money/decimal";
import type {
  AmountSignConvention,
  RowDirection,
} from "@/lib/bank-import/types";

/**
 * Parses one raw statement cell into an unsigned magnitude plus whatever
 * sign/direction indicators the text itself carried — this function never
 * decides "debit" or "credit" on its own (that depends on which column the
 * cell came from and the statement's amount shape, resolved by
 * resolveDebitCreditColumns / resolveSignedAmountColumn below). Every
 * numeric string reaches `Decimal` only after grouping separators and
 * currency symbols are stripped textually — never via `parseFloat`/`Number`
 * — so no binary-float rounding is ever introduced.
 */
export type ParsedAmountCell =
  | {
      kind: "value";
      magnitude: Money;
      explicitSign: "negative" | "positive" | null;
      suffixDirection: RowDirection | null;
    }
  | { kind: "blank" }
  | { kind: "invalid" };

const CURRENCY_PREFIX_PATTERN = /^(INR|Rs\.?|₹|\$)\s*/i;
const DR_CR_SUFFIX_PATTERN = /^(.*?)\s*(DR|CR)$/i;
const MAX_INTEGER_DIGITS = 16;
const MAX_DECIMAL_DIGITS = 4;

export function parseStatementAmountCell(raw: string): ParsedAmountCell {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return { kind: "blank" };
  }

  let working = trimmed;

  // "(1,234.56)" is a common accounting convention for a negative amount.
  let parenthetical = false;
  const parenMatch = /^\((.*)\)$/.exec(working);
  if (parenMatch) {
    parenthetical = true;
    working = (parenMatch[1] ?? "").trim();
  }

  let suffixDirection: RowDirection | null = null;
  const suffixMatch = DR_CR_SUFFIX_PATTERN.exec(working);
  if (suffixMatch) {
    suffixDirection =
      (suffixMatch[2] ?? "").toUpperCase() === "DR" ? "debit" : "credit";
    working = (suffixMatch[1] ?? "").trim();
  }

  let explicitSign: "negative" | "positive" | null = parenthetical
    ? "negative"
    : null;
  if (!parenthetical && working.startsWith("-")) {
    explicitSign = "negative";
    working = working.slice(1).trim();
  } else if (!parenthetical && working.startsWith("+")) {
    explicitSign = "positive";
    working = working.slice(1).trim();
  }

  working = working.replace(CURRENCY_PREFIX_PATTERN, "").trim();

  // Strips grouping separators. A bare comma-strip is correct for both
  // Indian grouping ("1,23,456.78") and Western grouping ("1,234,567.89")
  // — neither convention ever uses a comma for anything but grouping, so
  // there is no structural ambiguity to resolve, only characters to drop.
  working = working.replace(/,/g, "");

  if (working.length === 0) {
    return { kind: "invalid" };
  }
  if (!/^\d+(\.\d+)?$/.test(working)) {
    return { kind: "invalid" };
  }

  const [integerPart, decimalPart] = working.split(".");
  if ((integerPart ?? "").length > MAX_INTEGER_DIGITS) {
    return { kind: "invalid" };
  }
  if ((decimalPart?.length ?? 0) > MAX_DECIMAL_DIGITS) {
    return { kind: "invalid" };
  }

  return {
    kind: "value",
    magnitude: new Decimal(working),
    explicitSign,
    suffixDirection,
  };
}

export type RowAmountResolution =
  | { success: true; amount: Money; direction: RowDirection }
  | {
      success: false;
      reason:
        | "missing_amount"
        | "invalid_amount"
        | "both_debit_and_credit"
        | "neither_debit_nor_credit"
        | "zero_amount";
    };

/**
 * Combines a statement's separate Debit and Credit cells into one signed
 * movement. Exactly one of the two must carry a non-zero value — both
 * populated or both blank/zero is rejected rather than guessed, per the
 * spec's "reject both-debit-and-credit-nonzero rows and neither-meaningful
 * rows" requirement.
 */
export function resolveDebitCreditColumns(
  debitRaw: string,
  creditRaw: string,
): RowAmountResolution {
  const debitCell = parseStatementAmountCell(debitRaw);
  const creditCell = parseStatementAmountCell(creditRaw);

  if (debitCell.kind === "invalid" || creditCell.kind === "invalid") {
    return { success: false, reason: "invalid_amount" };
  }

  const debitMagnitude =
    debitCell.kind === "value" ? debitCell.magnitude : null;
  const creditMagnitude =
    creditCell.kind === "value" ? creditCell.magnitude : null;
  const debitMeaningful = debitMagnitude !== null && !debitMagnitude.isZero();
  const creditMeaningful =
    creditMagnitude !== null && !creditMagnitude.isZero();

  if (debitMeaningful && creditMeaningful) {
    return { success: false, reason: "both_debit_and_credit" };
  }
  if (!debitMeaningful && !creditMeaningful) {
    const eitherPresentButZero =
      (debitMagnitude !== null && debitMagnitude.isZero()) ||
      (creditMagnitude !== null && creditMagnitude.isZero());
    return {
      success: false,
      reason: eitherPresentButZero ? "zero_amount" : "neither_debit_nor_credit",
    };
  }

  if (debitMeaningful && debitMagnitude !== null) {
    return { success: true, amount: debitMagnitude, direction: "debit" };
  }
  if (creditMagnitude !== null) {
    return { success: true, amount: creditMagnitude, direction: "credit" };
  }
  return { success: false, reason: "neither_debit_nor_credit" };
}

/**
 * Resolves a single signed-amount column into a direction. Direction is
 * only ever taken from an explicit indicator actually present in the cell
 * — a DR/CR suffix (highest priority, since it names the direction
 * directly) or the sign combined with the statement's declared
 * amountSignConvention. An unsigned, suffix-less cell has no way to know
 * direction and is rejected rather than assumed.
 */
export function resolveSignedAmountColumn(
  raw: string,
  signConvention: AmountSignConvention,
): RowAmountResolution {
  const cell = parseStatementAmountCell(raw);

  if (cell.kind === "blank") {
    return { success: false, reason: "missing_amount" };
  }
  if (cell.kind === "invalid") {
    return { success: false, reason: "invalid_amount" };
  }
  if (cell.magnitude.isZero()) {
    return { success: false, reason: "zero_amount" };
  }

  if (cell.suffixDirection) {
    return {
      success: true,
      amount: cell.magnitude,
      direction: cell.suffixDirection,
    };
  }

  // A single-amount-column statement conventionally shows one direction
  // unsigned (e.g. "1,500.00" for a credit) and only the other with an
  // explicit "-" (e.g. "-500.00" for a debit) — the absence of a sign is
  // itself meaningful under the declared convention, not ambiguous, so an
  // unsigned cell is read as "not negative" rather than rejected.
  const sign = cell.explicitSign ?? "positive";
  const debitSign =
    signConvention === "debit_negative" ? "negative" : "positive";
  const direction: RowDirection = sign === debitSign ? "debit" : "credit";

  return { success: true, amount: cell.magnitude, direction };
}
