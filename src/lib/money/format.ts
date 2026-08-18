import type { Money } from "@/lib/money/decimal";
import { Decimal } from "@/lib/money/decimal";

const inrFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Formats a money value for display only — `Intl.NumberFormat` converts to
 * a JS `number` purely to render digits/grouping/symbol; that conversion
 * must never feed back into arithmetic (see src/lib/money/decimal.ts,
 * which keeps all real computation on `Decimal`).
 */
export function formatINR(value: Money | string): string {
  const decimal = typeof value === "string" ? new Decimal(value) : value;
  return inrFormatter.format(decimal.toNumber());
}
