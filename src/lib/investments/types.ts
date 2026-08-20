import { nowAsIstCalendarDate } from "@/lib/dates/timezone";
import type { Tables } from "@/types/database.types";

export type InvestmentAssetRow = Tables<"investment_assets">;
export type InvestmentHoldingRow = Tables<"investment_holdings">;
export type InvestmentActivityRow = Tables<"investment_activities">;
export type InvestmentValuationRow = Tables<"investment_valuations">;
export type FixedIncomeDetailsRow = Tables<"fixed_income_details">;

export const INVESTMENT_ASSET_KINDS = [
  "stock",
  "mutual_fund",
  "ppf",
  "fixed_deposit",
  "recurring_deposit",
  "other_investment",
] as const;
export type InvestmentAssetKind = (typeof INVESTMENT_ASSET_KINDS)[number];

export const INVESTMENT_ASSET_KIND_LABELS: Record<InvestmentAssetKind, string> =
  {
    stock: "Stock",
    mutual_fund: "Mutual fund",
    ppf: "PPF",
    fixed_deposit: "Fixed deposit",
    recurring_deposit: "Recurring deposit",
    other_investment: "Other investment",
  };

export const INVESTMENT_ASSET_STATUSES = ["active", "archived"] as const;
export type InvestmentAssetStatus = (typeof INVESTMENT_ASSET_STATUSES)[number];

export const INVESTMENT_HOLDING_STATUSES = ["active", "archived"] as const;
export type InvestmentHoldingStatus =
  (typeof INVESTMENT_HOLDING_STATUSES)[number];

export const INVESTMENT_ACTIVITY_KINDS = [
  "buy",
  "sell",
  "contribution",
  "withdrawal",
  "dividend",
  "interest",
  "fee",
  "maturity",
  "adjustment",
] as const;
export type InvestmentActivityKind = (typeof INVESTMENT_ACTIVITY_KINDS)[number];

export const INVESTMENT_ACTIVITY_KIND_LABELS: Record<
  InvestmentActivityKind,
  string
> = {
  buy: "Buy",
  sell: "Sell",
  contribution: "Contribution",
  withdrawal: "Withdrawal",
  dividend: "Dividend",
  interest: "Interest",
  fee: "Fee",
  maturity: "Maturity",
  adjustment: "Adjustment",
};

export const INVESTMENT_ACTIVITY_STATUSES = ["posted", "reversed"] as const;
export type InvestmentActivityStatus =
  (typeof INVESTMENT_ACTIVITY_STATUSES)[number];

/** Always 'manual' in this phase — never a live/market source. */
export const VALUATION_SOURCES = ["manual"] as const;
export type ValuationSource = (typeof VALUATION_SOURCES)[number];

export const FIXED_INCOME_KINDS = [
  "ppf",
  "fixed_deposit",
  "recurring_deposit",
] as const;
export type FixedIncomeKind = (typeof FIXED_INCOME_KINDS)[number];

export const FIXED_INCOME_STATUSES = [
  "active",
  "matured",
  "closed",
  "archived",
] as const;
export type FixedIncomeStatus = (typeof FIXED_INCOME_STATUSES)[number];

export const COMPOUNDING_FREQUENCIES = [
  "monthly",
  "quarterly",
  "half_yearly",
  "yearly",
  "at_maturity",
] as const;
export type CompoundingFrequency = (typeof COMPOUNDING_FREQUENCIES)[number];

export const COMPOUNDING_FREQUENCY_LABELS: Record<
  CompoundingFrequency,
  string
> = {
  monthly: "Monthly",
  quarterly: "Quarterly",
  half_yearly: "Half-yearly",
  yearly: "Yearly",
  at_maturity: "At maturity",
};

export const INTEREST_PAYOUT_MODES = ["reinvest", "payout"] as const;
export type InterestPayoutMode = (typeof INTEREST_PAYOUT_MODES)[number];

export const INTEREST_PAYOUT_MODE_LABELS: Record<InterestPayoutMode, string> = {
  reinvest: "Reinvested",
  payout: "Paid out",
};

/** The start date ("YYYY-04-01") of the Indian financial year "today" (Asia/Kolkata) falls in — FY runs Apr 1 to Mar 31. */
export function currentIndianFinancialYearStart(): string {
  const today = nowAsIstCalendarDate();
  const [yearText, monthText] = today.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const fyStartYear = month >= 4 ? year : year - 1;
  return `${fyStartYear}-04-01`;
}

/** Which activity kinds make sense to compose for a holding of this asset kind — e.g. a PPF holding never buys/sells units. */
export function supportedActivityKindsForAssetKind(
  assetKind: InvestmentAssetKind,
): InvestmentActivityKind[] {
  switch (assetKind) {
    case "stock":
    case "mutual_fund":
      return ["buy", "sell", "dividend", "interest", "fee", "adjustment"];
    case "other_investment":
      return [
        "contribution",
        "withdrawal",
        "dividend",
        "interest",
        "fee",
        "adjustment",
      ];
    case "ppf":
      return ["contribution", "withdrawal", "interest", "fee", "adjustment"];
    case "fixed_deposit":
      return ["contribution", "withdrawal", "fee", "adjustment"];
    case "recurring_deposit":
      return ["contribution", "fee", "adjustment"];
    default:
      return ["adjustment"];
  }
}
