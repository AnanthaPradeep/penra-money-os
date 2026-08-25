import type { Money } from "@/lib/money/decimal";
import { Decimal } from "@/lib/money/decimal";

const inrFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * AI provider cost/spend-cap fields (ai_provider_models, ai_usage_daily)
 * are the one domain in this app denominated in USD, not INR — every
 * other Money value is an Indian-market figure. Never pass a USD amount
 * to formatINR/AmountDisplay, which would render the wrong currency
 * symbol over the right digits and misrepresent the value.
 */
const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
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

export function formatUSD(value: Money | string): string {
  const decimal = typeof value === "string" ? new Decimal(value) : value;
  return usdFormatter.format(decimal.toNumber());
}
