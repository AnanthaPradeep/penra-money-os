import { Decimal, type Money } from "@/lib/money/decimal";
import { MONEY_MAX_INTEGER_DIGITS } from "@/lib/money/constants";

/** Mirrors the `numeric(20,6)` columns used for investment quantity/unit price (see supabase/migrations) — more fractional precision than money's 4 places, since mutual fund units and per-unit prices routinely need it. */
export const QUANTITY_DECIMAL_PLACES = 6;

export type QuantityParseResult =
  { success: true; value: Money } | { success: false; error: string };

const STRICT_UNSIGNED_QUANTITY_PATTERN = new RegExp(
  `^\\d{1,${MONEY_MAX_INTEGER_DIGITS}}(\\.\\d{1,${QUANTITY_DECIMAL_PLACES}})?$`,
);

/**
 * Parses a user-entered unit quantity or unit price — a positive, non-zero
 * decimal with up to 6 fractional digits (mutual fund units, per-unit
 * prices). Same strict-pattern-before-Decimal approach as
 * src/lib/money/parse.ts, and for the same reason: reject scientific
 * notation/signs/whitespace before Decimal ever sees the string.
 */
export function parsePositiveQuantityInput(raw: string): QuantityParseResult {
  const trimmed = raw.trim();

  if (trimmed.length === 0) {
    return { success: false, error: "Enter a value." };
  }

  if (!STRICT_UNSIGNED_QUANTITY_PATTERN.test(trimmed)) {
    return {
      success: false,
      error: "Enter a valid number using digits and up to 6 decimal places.",
    };
  }

  const value = new Decimal(trimmed);

  if (value.isZero()) {
    return { success: false, error: "Value must be greater than zero." };
  }

  return { success: true, value };
}

/** Canonical string form for sending a quantity/unit-price value to the database. */
export function toDbQuantityString(value: Money): string {
  return value.toFixed(QUANTITY_DECIMAL_PLACES);
}

const STRICT_SIGNED_DECIMAL_PATTERN = new RegExp(
  `^-?\\d{1,${MONEY_MAX_INTEGER_DIGITS}}(\\.\\d{1,${QUANTITY_DECIMAL_PLACES}})?$`,
);

/**
 * Parses a signed decimal correction delta — used only by the investment
 * adjustment workflow (src/lib/investments/schema.ts), where a
 * quantity/cost-basis correction can legitimately be negative. Blank
 * input parses to `undefined` (an adjustment may touch only one of the
 * two fields), matching optionalPositiveMoneyInputSchema's blank-is-
 * absent convention.
 */
export function parseOptionalSignedDecimalInput(
  raw: string,
): QuantityParseResult | { success: true; value: undefined } {
  const trimmed = raw.trim();

  if (trimmed.length === 0) {
    return { success: true, value: undefined };
  }

  if (!STRICT_SIGNED_DECIMAL_PATTERN.test(trimmed)) {
    return {
      success: false,
      error: "Enter a valid number using digits and up to 6 decimal places.",
    };
  }

  const value = new Decimal(trimmed);

  if (value.isZero()) {
    return { success: false, error: "A correction delta cannot be zero." };
  }

  return { success: true, value };
}
