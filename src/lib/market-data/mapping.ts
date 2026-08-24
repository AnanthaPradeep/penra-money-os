import { Decimal, type Money } from "@/lib/money/decimal";
import {
  MARKET_DATA_PROVIDERS,
  MARKET_INSTRUMENT_KINDS,
  MARKET_PRICE_KINDS,
  type MarketDataProvider,
  type MarketDataProviderStateRow,
  type MarketInstrumentKind,
  type MarketInstrumentRow,
  type MarketPriceKind,
  type MarketPriceRow,
  type PortfolioValueSnapshotRow,
} from "@/lib/market-data/types";
import { assertLiteral } from "@/lib/types/literal";

export type MarketInstrument = {
  id: string;
  provider: MarketDataProvider;
  providerInstrumentId: string;
  symbol: string | null;
  exchange: string | null;
  mic: string | null;
  isin: string | null;
  name: string;
  instrumentKind: MarketInstrumentKind;
  quoteCurrency: string;
  timezone: string;
  isActive: boolean;
  lastSuccessfulRefreshAt: string | null;
};

export function mapMarketInstrumentRow(
  row: MarketInstrumentRow,
): MarketInstrument {
  return {
    id: row.id,
    provider: assertLiteral(
      row.provider,
      MARKET_DATA_PROVIDERS,
      "market_instruments.provider",
    ),
    providerInstrumentId: row.provider_instrument_id,
    symbol: row.symbol,
    exchange: row.exchange,
    mic: row.mic,
    isin: row.isin,
    name: row.name,
    instrumentKind: assertLiteral(
      row.instrument_kind,
      MARKET_INSTRUMENT_KINDS,
      "market_instruments.instrument_kind",
    ),
    quoteCurrency: row.quote_currency,
    timezone: row.timezone,
    isActive: row.is_active,
    lastSuccessfulRefreshAt: row.last_successful_refresh_at,
  };
}

export type MarketPrice = {
  id: string;
  instrumentId: string;
  priceKind: MarketPriceKind;
  effectiveDate: string;
  price: Money;
  currency: string;
  provider: MarketDataProvider;
  receivedAt: string;
  providerTimestamp: string | null;
  isCurrent: boolean;
};

export function mapMarketPriceRow(row: MarketPriceRow): MarketPrice {
  return {
    id: row.id,
    instrumentId: row.instrument_id,
    priceKind: assertLiteral(
      row.price_kind,
      MARKET_PRICE_KINDS,
      "market_prices.price_kind",
    ),
    effectiveDate: row.effective_date,
    price: new Decimal(row.price),
    currency: row.currency,
    provider: assertLiteral(
      row.provider,
      MARKET_DATA_PROVIDERS,
      "market_prices.provider",
    ),
    receivedAt: row.received_at,
    providerTimestamp: row.provider_timestamp,
    isCurrent: row.is_current,
  };
}

export type MarketDataProviderState = {
  provider: MarketDataProvider;
  isConfigured: boolean;
  lastSuccessAt: string | null;
  lastAttemptAt: string | null;
  lastErrorCode: string | null;
  consecutiveFailures: number;
  notes: string | null;
  updatedAt: string;
};

export function mapMarketDataProviderStateRow(
  row: MarketDataProviderStateRow,
): MarketDataProviderState {
  return {
    provider: assertLiteral(
      row.provider,
      MARKET_DATA_PROVIDERS,
      "market_data_provider_state.provider",
    ),
    isConfigured: row.is_configured,
    lastSuccessAt: row.last_success_at,
    lastAttemptAt: row.last_attempt_at,
    lastErrorCode: row.last_error_code,
    consecutiveFailures: row.consecutive_failures,
    notes: row.notes,
    updatedAt: row.updated_at,
  };
}

export type PortfolioValueSnapshot = {
  id: string;
  currency: string;
  snapshotDate: string;
  investedCost: Money;
  valuedTotal: Money;
  cashTotal: Money | null;
  liabilitiesTotal: Money | null;
  realizedGain: Money;
  unrealizedGain: Money;
  externalCashFlow: Money;
  valuationCoveragePercent: number;
};

export function mapPortfolioValueSnapshotRow(
  row: PortfolioValueSnapshotRow,
): PortfolioValueSnapshot {
  return {
    id: row.id,
    currency: row.currency,
    snapshotDate: row.snapshot_date,
    investedCost: new Decimal(row.invested_cost),
    valuedTotal: new Decimal(row.valued_total),
    cashTotal: row.cash_total === null ? null : new Decimal(row.cash_total),
    liabilitiesTotal:
      row.liabilities_total === null
        ? null
        : new Decimal(row.liabilities_total),
    realizedGain: new Decimal(row.realized_gain),
    unrealizedGain: new Decimal(row.unrealized_gain),
    externalCashFlow: new Decimal(row.external_cash_flow),
    valuationCoveragePercent: row.valuation_coverage_percent,
  };
}
