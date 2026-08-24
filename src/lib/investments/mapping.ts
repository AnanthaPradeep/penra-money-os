import { Decimal, type Money } from "@/lib/money/decimal";
import { isOneOf } from "@/lib/types/literal";
import {
  COMPOUNDING_FREQUENCIES,
  FIXED_INCOME_KINDS,
  FIXED_INCOME_STATUSES,
  INTEREST_PAYOUT_MODES,
  INVESTMENT_ACTIVITY_KINDS,
  INVESTMENT_ACTIVITY_STATUSES,
  INVESTMENT_ASSET_KINDS,
  INVESTMENT_ASSET_STATUSES,
  INVESTMENT_HOLDING_STATUSES,
  VALUATION_SOURCES,
  type CompoundingFrequency,
  type FixedIncomeDetailsRow,
  type FixedIncomeKind,
  type FixedIncomeStatus,
  type InterestPayoutMode,
  type InvestmentActivityKind,
  type InvestmentActivityRow,
  type InvestmentActivityStatus,
  type InvestmentAssetKind,
  type InvestmentAssetRow,
  type InvestmentAssetStatus,
  type InvestmentHoldingRow,
  type InvestmentHoldingStatus,
  type InvestmentValuationRow,
  type ValuationSource,
} from "@/lib/investments/types";
import {
  HOLDING_VALUATION_SOURCES,
  MARKET_PRICE_STATUSES,
  type HoldingValuationSource,
  type MarketPriceStatus,
} from "@/lib/market-data/types";
import { assertLiteral } from "@/lib/types/literal";

export type InvestmentAsset = {
  id: string;
  assetKind: InvestmentAssetKind;
  displayName: string;
  symbol: string | null;
  exchange: string | null;
  isin: string | null;
  schemeCode: string | null;
  currency: string;
  unitPrecision: number;
  investmentAccountId: string | null;
  status: InvestmentAssetStatus;
  notes: string | null;
  marketInstrumentId: string | null;
  marketLinkConfirmedAt: string | null;
};

export function mapInvestmentAssetRow(
  row: InvestmentAssetRow,
): InvestmentAsset {
  return {
    id: row.id,
    assetKind: assertLiteral(
      row.asset_kind,
      INVESTMENT_ASSET_KINDS,
      "investment_assets.asset_kind",
    ),
    displayName: row.display_name,
    symbol: row.symbol,
    exchange: row.exchange,
    isin: row.isin,
    schemeCode: row.scheme_code,
    currency: row.currency,
    unitPrecision: row.unit_precision,
    investmentAccountId: row.investment_account_id,
    status: assertLiteral(
      row.status,
      INVESTMENT_ASSET_STATUSES,
      "investment_assets.status",
    ),
    notes: row.notes,
    marketInstrumentId: row.market_instrument_id,
    marketLinkConfirmedAt: row.market_link_confirmed_at,
  };
}

export type InvestmentHolding = {
  id: string;
  investmentAssetId: string;
  investmentAccountId: string | null;
  currency: string;
  openedDate: string;
  status: InvestmentHoldingStatus;
};

export function mapInvestmentHoldingRow(
  row: InvestmentHoldingRow,
): InvestmentHolding {
  return {
    id: row.id,
    investmentAssetId: row.investment_asset_id,
    investmentAccountId: row.investment_account_id,
    currency: row.currency,
    openedDate: row.opened_date,
    status: assertLiteral(
      row.status,
      INVESTMENT_HOLDING_STATUSES,
      "investment_holdings.status",
    ),
  };
}

export type InvestmentActivity = {
  id: string;
  holdingId: string;
  activityKind: InvestmentActivityKind;
  tradeDate: string;
  settlementDate: string | null;
  quantity: Money | null;
  unitPrice: Money | null;
  grossAmount: Money;
  feeAmount: Money;
  taxAmount: Money;
  costBasisAmount: Money | null;
  realizedGainAmount: Money | null;
  currency: string;
  categoryId: string | null;
  payeeId: string | null;
  ledgerTransactionId: string | null;
  notes: string | null;
  status: InvestmentActivityStatus;
  reversalOf: string | null;
  reversedBy: string | null;
};

export function mapInvestmentActivityRow(
  row: InvestmentActivityRow,
): InvestmentActivity {
  return {
    id: row.id,
    holdingId: row.holding_id,
    activityKind: assertLiteral(
      row.activity_kind,
      INVESTMENT_ACTIVITY_KINDS,
      "investment_activities.activity_kind",
    ),
    tradeDate: row.trade_date,
    settlementDate: row.settlement_date,
    quantity: row.quantity === null ? null : new Decimal(row.quantity),
    unitPrice: row.unit_price === null ? null : new Decimal(row.unit_price),
    grossAmount: new Decimal(row.gross_amount),
    feeAmount: new Decimal(row.fee_amount),
    taxAmount: new Decimal(row.tax_amount),
    costBasisAmount:
      row.cost_basis_amount === null
        ? null
        : new Decimal(row.cost_basis_amount),
    realizedGainAmount:
      row.realized_gain_amount === null
        ? null
        : new Decimal(row.realized_gain_amount),
    currency: row.currency,
    categoryId: row.category_id,
    payeeId: row.payee_id,
    ledgerTransactionId: row.ledger_transaction_id,
    notes: row.notes,
    status: assertLiteral(
      row.status,
      INVESTMENT_ACTIVITY_STATUSES,
      "investment_activities.status",
    ),
    reversalOf: row.reversal_of,
    reversedBy: row.reversed_by,
  };
}

export type InvestmentValuation = {
  id: string;
  holdingId: string;
  valuedAt: string;
  unitValue: Money | null;
  totalValue: Money;
  currency: string;
  source: ValuationSource;
  note: string | null;
};

export function mapInvestmentValuationRow(
  row: InvestmentValuationRow,
): InvestmentValuation {
  return {
    id: row.id,
    holdingId: row.holding_id,
    valuedAt: row.valued_at,
    unitValue: row.unit_value === null ? null : new Decimal(row.unit_value),
    totalValue: new Decimal(row.total_value),
    currency: row.currency,
    source: assertLiteral(
      row.source,
      VALUATION_SOURCES,
      "investment_valuations.source",
    ),
    note: row.note,
  };
}

export type FixedIncomeDetails = {
  id: string;
  holdingId: string;
  kind: FixedIncomeKind;
  provider: string | null;
  principalAmount: Money | null;
  interestRate: Money | null;
  startDate: string;
  maturityDate: string | null;
  compoundingFrequency: CompoundingFrequency | null;
  interestPayoutMode: InterestPayoutMode | null;
  expectedMaturityAmount: Money | null;
  actualMaturityAmount: Money | null;
  installmentAmount: Money | null;
  plannedInstallments: number | null;
  recurringItemId: string | null;
  status: FixedIncomeStatus;
  notes: string | null;
};

export function mapFixedIncomeDetailsRow(
  row: FixedIncomeDetailsRow,
): FixedIncomeDetails {
  return {
    id: row.id,
    holdingId: row.holding_id,
    kind: assertLiteral(
      row.kind,
      FIXED_INCOME_KINDS,
      "fixed_income_details.kind",
    ),
    provider: row.provider,
    principalAmount:
      row.principal_amount === null ? null : new Decimal(row.principal_amount),
    interestRate:
      row.interest_rate === null ? null : new Decimal(row.interest_rate),
    startDate: row.start_date,
    maturityDate: row.maturity_date,
    compoundingFrequency:
      row.compounding_frequency !== null &&
      isOneOf(row.compounding_frequency, COMPOUNDING_FREQUENCIES)
        ? row.compounding_frequency
        : null,
    interestPayoutMode:
      row.interest_payout_mode !== null &&
      isOneOf(row.interest_payout_mode, INTEREST_PAYOUT_MODES)
        ? row.interest_payout_mode
        : null,
    expectedMaturityAmount:
      row.expected_maturity_amount === null
        ? null
        : new Decimal(row.expected_maturity_amount),
    actualMaturityAmount:
      row.actual_maturity_amount === null
        ? null
        : new Decimal(row.actual_maturity_amount),
    installmentAmount:
      row.installment_amount === null
        ? null
        : new Decimal(row.installment_amount),
    plannedInstallments: row.planned_installments,
    recurringItemId: row.recurring_item_id,
    status: assertLiteral(
      row.status,
      FIXED_INCOME_STATUSES,
      "fixed_income_details.status",
    ),
    notes: row.notes,
  };
}

// ---------------------------------------------------------------------
// Summary RPC row shapes. Several generated Args/Returns types claim
// non-null for a column that is genuinely nullable at the SQL level (a
// LEFT JOIN result) — the same class of codegen inaccuracy already
// documented for Phase 6's budget_category_progress — so every mapper
// below treats latest_valuation/latest_valuation_at/unrealized_gain
// defensively, never trusting the generated non-null claim.
// ---------------------------------------------------------------------

type HoldingSummaryRow = {
  holding_id: string;
  investment_asset_id: string;
  asset_kind: string;
  display_name: string;
  symbol: string | null;
  currency: string;
  status: string;
  quantity: number;
  avg_unit_cost: number | null;
  cost_basis: number;
  has_valuation: boolean;
  valuation_source: string;
  price_effective_date: string | null;
  last_refreshed_at: string | null;
  price_status: string;
  current_value: number;
  unrealized_gain: number | null;
  realized_gain: number;
  income_received: number;
};

export type HoldingSummary = {
  holdingId: string;
  investmentAssetId: string;
  assetKind: InvestmentAssetKind;
  displayName: string;
  symbol: string | null;
  currency: string;
  status: InvestmentHoldingStatus;
  quantity: Money;
  avgUnitCost: Money | null;
  costBasis: Money;
  hasValuation: boolean;
  valuationSource: HoldingValuationSource;
  priceEffectiveDate: string | null;
  lastRefreshedAt: string | null;
  priceStatus: MarketPriceStatus;
  currentValue: Money;
  unrealizedGain: Money | null;
  realizedGain: Money;
  incomeReceived: Money;
};

export function mapHoldingSummaryRow(row: HoldingSummaryRow): HoldingSummary {
  return {
    holdingId: row.holding_id,
    investmentAssetId: row.investment_asset_id,
    assetKind: assertLiteral(
      row.asset_kind,
      INVESTMENT_ASSET_KINDS,
      "investment_holding_summary.asset_kind",
    ),
    displayName: row.display_name,
    symbol: row.symbol,
    currency: row.currency,
    status: assertLiteral(
      row.status,
      INVESTMENT_HOLDING_STATUSES,
      "investment_holding_summary.status",
    ),
    quantity: new Decimal(row.quantity),
    avgUnitCost:
      row.avg_unit_cost === null ? null : new Decimal(row.avg_unit_cost),
    costBasis: new Decimal(row.cost_basis),
    hasValuation: row.has_valuation,
    valuationSource: assertLiteral(
      row.valuation_source,
      HOLDING_VALUATION_SOURCES,
      "investment_holding_summary.valuation_source",
    ),
    priceEffectiveDate: row.price_effective_date,
    lastRefreshedAt: row.last_refreshed_at,
    priceStatus: assertLiteral(
      row.price_status,
      MARKET_PRICE_STATUSES,
      "investment_holding_summary.price_status",
    ),
    currentValue: new Decimal(row.current_value),
    unrealizedGain:
      row.unrealized_gain === null ? null : new Decimal(row.unrealized_gain),
    realizedGain: new Decimal(row.realized_gain),
    incomeReceived: new Decimal(row.income_received),
  };
}

type PortfolioSummaryRow = {
  currency: string;
  total_invested_cost: number;
  total_current_value: number;
  total_unrealized_gain: number;
  total_realized_gain: number;
  total_income_received: number;
  active_holdings_count: number;
  missing_valuation_count: number;
};

export type PortfolioSummary = {
  currency: string;
  totalInvestedCost: Money;
  totalCurrentValue: Money;
  totalUnrealizedGain: Money;
  totalRealizedGain: Money;
  totalIncomeReceived: Money;
  activeHoldingsCount: number;
  missingValuationCount: number;
};

export function mapPortfolioSummaryRow(
  row: PortfolioSummaryRow,
): PortfolioSummary {
  return {
    currency: row.currency,
    totalInvestedCost: new Decimal(row.total_invested_cost),
    totalCurrentValue: new Decimal(row.total_current_value),
    totalUnrealizedGain: new Decimal(row.total_unrealized_gain),
    totalRealizedGain: new Decimal(row.total_realized_gain),
    totalIncomeReceived: new Decimal(row.total_income_received),
    activeHoldingsCount: row.active_holdings_count,
    missingValuationCount: row.missing_valuation_count,
  };
}

type NetWorthSummaryRow = {
  currency: string;
  cash_and_bank: number;
  investment_value: number;
  ppf_balance: number;
  fd_value: number;
  rd_balance: number;
  credit_card_outstanding: number;
  other_liabilities: number;
  total_assets: number;
  total_liabilities: number;
  net_worth: number;
};

export type NetWorthSummary = {
  currency: string;
  cashAndBank: Money;
  investmentValue: Money;
  ppfBalance: Money;
  fdValue: Money;
  rdBalance: Money;
  creditCardOutstanding: Money;
  otherLiabilities: Money;
  totalAssets: Money;
  totalLiabilities: Money;
  netWorth: Money;
};

export function mapNetWorthSummaryRow(
  row: NetWorthSummaryRow,
): NetWorthSummary {
  return {
    currency: row.currency,
    cashAndBank: new Decimal(row.cash_and_bank),
    investmentValue: new Decimal(row.investment_value),
    ppfBalance: new Decimal(row.ppf_balance),
    fdValue: new Decimal(row.fd_value),
    rdBalance: new Decimal(row.rd_balance),
    creditCardOutstanding: new Decimal(row.credit_card_outstanding),
    otherLiabilities: new Decimal(row.other_liabilities),
    totalAssets: new Decimal(row.total_assets),
    totalLiabilities: new Decimal(row.total_liabilities),
    netWorth: new Decimal(row.net_worth),
  };
}

type AllocationByKindRow = {
  currency: string;
  asset_kind: string;
  current_value: number;
  percent_of_portfolio: number;
};

export type AllocationByKind = {
  currency: string;
  assetKind: InvestmentAssetKind;
  currentValue: Money;
  percentOfPortfolio: Money;
};

export function mapAllocationByKindRow(
  row: AllocationByKindRow,
): AllocationByKind {
  return {
    currency: row.currency,
    assetKind: assertLiteral(
      row.asset_kind,
      INVESTMENT_ASSET_KINDS,
      "asset_allocation_by_kind.asset_kind",
    ),
    currentValue: new Decimal(row.current_value),
    percentOfPortfolio: new Decimal(row.percent_of_portfolio),
  };
}

type AllocationByAssetRow = {
  currency: string;
  investment_asset_id: string;
  display_name: string;
  asset_kind: string;
  current_value: number;
  percent_of_portfolio: number;
};

export type AllocationByAsset = {
  currency: string;
  investmentAssetId: string;
  displayName: string;
  assetKind: InvestmentAssetKind;
  currentValue: Money;
  percentOfPortfolio: Money;
};

export function mapAllocationByAssetRow(
  row: AllocationByAssetRow,
): AllocationByAsset {
  return {
    currency: row.currency,
    investmentAssetId: row.investment_asset_id,
    displayName: row.display_name,
    assetKind: assertLiteral(
      row.asset_kind,
      INVESTMENT_ASSET_KINDS,
      "asset_allocation_by_asset.asset_kind",
    ),
    currentValue: new Decimal(row.current_value),
    percentOfPortfolio: new Decimal(row.percent_of_portfolio),
  };
}

type MaturityEventRow = {
  holding_id: string;
  display_name: string;
  kind: string;
  maturity_date: string | null;
  expected_maturity_amount: number | null;
};

export type MaturityEvent = {
  holdingId: string;
  displayName: string;
  kind: FixedIncomeKind;
  maturityDate: string;
  expectedMaturityAmount: Money | null;
};

export function mapMaturityEventRow(
  row: MaturityEventRow,
): MaturityEvent | null {
  if (row.maturity_date === null) {
    return null;
  }
  return {
    holdingId: row.holding_id,
    displayName: row.display_name,
    kind: assertLiteral(
      row.kind,
      FIXED_INCOME_KINDS,
      "upcoming_maturity_events.kind",
    ),
    maturityDate: row.maturity_date,
    expectedMaturityAmount:
      row.expected_maturity_amount === null
        ? null
        : new Decimal(row.expected_maturity_amount),
  };
}

type PpfFinancialYearSummaryRow = {
  holding_id: string;
  display_name: string;
  financial_year_start: string;
  financial_year_end: string;
  total_contributions: number;
};

export type PpfFinancialYearSummary = {
  holdingId: string;
  displayName: string;
  financialYearStart: string;
  financialYearEnd: string;
  totalContributions: Money;
};

export function mapPpfFinancialYearSummaryRow(
  row: PpfFinancialYearSummaryRow,
): PpfFinancialYearSummary {
  return {
    holdingId: row.holding_id,
    displayName: row.display_name,
    financialYearStart: row.financial_year_start,
    financialYearEnd: row.financial_year_end,
    totalContributions: new Decimal(row.total_contributions),
  };
}
