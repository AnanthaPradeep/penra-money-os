import { Decimal, type Money } from "@/lib/money/decimal";
import {
  MONEY_DECIMAL_PLACES,
  MONEY_MAX_INTEGER_DIGITS,
} from "@/lib/money/constants";

export type MoneyParseResult =
  { success: true; value: Money } | { success: false; error: string };

/**
 * A plain, unsigned decimal string: digits, an optional single decimal
 * point, up to `MONEY_MAX_INTEGER_DIGITS` integer digits, up to
 * `MONEY_DECIMAL_PLACES` fractional digits. No leading `+`/`-`, no
 * exponent, no whitespace, no thousands separators. Matching this pattern
 * up front — before the string ever reaches `Decimal` — is what rejects
 * scientific notation ("1e3"), "Infinity", "NaN", and signed input, all of
 * which `Decimal` would otherwise parse without complaint.
 */
const STRICT_UNSIGNED_DECIMAL_PATTERN = new RegExp(
  `^\\d{1,${MONEY_MAX_INTEGER_DIGITS}}(\\.\\d{1,${MONEY_DECIMAL_PLACES}})?$`,
);

/**
 * Parses a user-entered amount for any form field in PENRA (transaction
 * amount, opening balance, credit limit). Every such field is a positive,
 * non-zero quantity — the sign of a ledger entry is always derived by
 * domain logic from the transaction type and account class, never typed
 * directly by the user (see src/lib/ledger/entry-builder.ts).
 */
export function parsePositiveMoneyInput(raw: string): MoneyParseResult {
  const trimmed = raw.trim();

  if (trimmed.length === 0) {
    return { success: false, error: "Enter an amount." };
  }

  if (!STRICT_UNSIGNED_DECIMAL_PATTERN.test(trimmed)) {
    return {
      success: false,
      error: "Enter a valid amount using digits and up to 4 decimal places.",
    };
  }

  const value = new Decimal(trimmed);

  if (value.isZero()) {
    return { success: false, error: "Amount must be greater than zero." };
  }

  return { success: true, value };
}

/** Canonical string form for sending a money value to the database — always exactly 4 decimal places. */
export function toDbAmountString(value: Money): string {
  return value.toFixed(MONEY_DECIMAL_PLACES);
}
