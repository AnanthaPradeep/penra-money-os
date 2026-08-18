import Decimal from "decimal.js";

/**
 * Every Decimal in PENRA represents a value that is ultimately stored in a
 * PostgreSQL `numeric(20,4)` column — up to 16 integer digits and exactly 4
 * fractional digits. This configuration is applied once, globally, so any
 * arithmetic anywhere in the app (never floating-point `number` math) is
 * consistent with that column type.
 */
Decimal.set({
  precision: 34,
  rounding: Decimal.ROUND_HALF_UP,
  toExpNeg: -30,
  toExpPos: 30,
});

export { Decimal };
export type Money = Decimal;
