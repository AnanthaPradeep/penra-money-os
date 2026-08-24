import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { getAuthenticatedUser } from "@/lib/auth/session";
import type {
  getFixedIncomeDetailsForHolding,
  getHoldingSummaryById,
  getInvestmentAssetById,
  getInvestmentHoldingById,
  listActivitiesForHolding,
  listValuationsForHolding,
} from "@/lib/investments/queries";
import type {
  InvestmentAsset,
  HoldingSummary,
} from "@/lib/investments/mapping";
import type {
  getMarketInstrumentById,
  getPriceHistoryForInstrument,
} from "@/lib/market-data/queries";
import { Decimal } from "@/lib/money/decimal";
import type { listAccountsWithBalances } from "@/lib/accounts/queries";

const getAuthenticatedUserMock = vi.fn<typeof getAuthenticatedUser>();
vi.mock("@/lib/auth/session", () => ({
  getAuthenticatedUser: (...args: Parameters<typeof getAuthenticatedUser>) =>
    getAuthenticatedUserMock(...args),
}));

const getInvestmentHoldingByIdMock = vi.fn<typeof getInvestmentHoldingById>();
const getInvestmentAssetByIdMock = vi.fn<typeof getInvestmentAssetById>();
const getHoldingSummaryByIdMock = vi.fn<typeof getHoldingSummaryById>();
const getFixedIncomeDetailsForHoldingMock =
  vi.fn<typeof getFixedIncomeDetailsForHolding>();
const listActivitiesForHoldingMock = vi.fn<typeof listActivitiesForHolding>();
const listValuationsForHoldingMock = vi.fn<typeof listValuationsForHolding>();
vi.mock("@/lib/investments/queries", () => ({
  getInvestmentHoldingById: (
    ...args: Parameters<typeof getInvestmentHoldingById>
  ) => getInvestmentHoldingByIdMock(...args),
  getInvestmentAssetById: (
    ...args: Parameters<typeof getInvestmentAssetById>
  ) => getInvestmentAssetByIdMock(...args),
  getHoldingSummaryById: (...args: Parameters<typeof getHoldingSummaryById>) =>
    getHoldingSummaryByIdMock(...args),
  getFixedIncomeDetailsForHolding: (
    ...args: Parameters<typeof getFixedIncomeDetailsForHolding>
  ) => getFixedIncomeDetailsForHoldingMock(...args),
  listActivitiesForHolding: (
    ...args: Parameters<typeof listActivitiesForHolding>
  ) => listActivitiesForHoldingMock(...args),
  listValuationsForHolding: (
    ...args: Parameters<typeof listValuationsForHolding>
  ) => listValuationsForHoldingMock(...args),
}));

const listAccountsWithBalancesMock = vi.fn<typeof listAccountsWithBalances>();
vi.mock("@/lib/accounts/queries", () => ({
  listAccountsWithBalances: (
    ...args: Parameters<typeof listAccountsWithBalances>
  ) => listAccountsWithBalancesMock(...args),
}));

const getMarketInstrumentByIdMock = vi.fn<typeof getMarketInstrumentById>();
const getPriceHistoryForInstrumentMock =
  vi.fn<typeof getPriceHistoryForInstrument>();
vi.mock("@/lib/market-data/queries", () => ({
  getMarketInstrumentById: (
    ...args: Parameters<typeof getMarketInstrumentById>
  ) => getMarketInstrumentByIdMock(...args),
  getPriceHistoryForInstrument: (
    ...args: Parameters<typeof getPriceHistoryForInstrument>
  ) => getPriceHistoryForInstrumentMock(...args),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(() => Promise.resolve({})),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string): never => {
    throw Object.assign(new Error(`NEXT_REDIRECT:${url}`), {
      digest: `NEXT_REDIRECT;push;${url};307;`,
    });
  }),
  notFound: vi.fn((): never => {
    throw Object.assign(new Error("NEXT_NOT_FOUND"), {
      digest: "NEXT_NOT_FOUND",
    });
  }),
  useRouter: () => ({ refresh: vi.fn() }),
}));

function asset(overrides: Partial<InvestmentAsset>): InvestmentAsset {
  return {
    id: "asset-1",
    assetKind: "mutual_fund",
    displayName: "Test Fund",
    symbol: null,
    exchange: null,
    isin: null,
    schemeCode: null,
    currency: "INR",
    unitPrecision: 4,
    investmentAccountId: null,
    status: "active",
    notes: null,
    marketInstrumentId: null,
    marketLinkConfirmedAt: null,
    ...overrides,
  };
}

function summary(overrides: Partial<HoldingSummary>): HoldingSummary {
  return {
    holdingId: "holding-1",
    investmentAssetId: "asset-1",
    assetKind: "mutual_fund",
    displayName: "Test Fund",
    symbol: null,
    currency: "INR",
    status: "active",
    quantity: new Decimal(10),
    avgUnitCost: new Decimal(100),
    costBasis: new Decimal(1000),
    hasValuation: true,
    valuationSource: "amfi",
    priceEffectiveDate: "2026-08-20",
    lastRefreshedAt: "2026-08-20T12:00:00Z",
    priceStatus: "fresh",
    currentValue: new Decimal(1100),
    unrealizedGain: new Decimal(100),
    realizedGain: new Decimal(0),
    incomeReceived: new Decimal(0),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  getAuthenticatedUserMock.mockResolvedValue({
    id: "user-1",
    email: "asha@example.com",
  });
  getInvestmentHoldingByIdMock.mockResolvedValue({
    id: "holding-1",
    investmentAssetId: "asset-1",
    investmentAccountId: null,
    currency: "INR",
    openedDate: "2025-01-01",
    status: "active",
  });
  getInvestmentAssetByIdMock.mockResolvedValue(asset({}));
  getHoldingSummaryByIdMock.mockResolvedValue(summary({}));
  getFixedIncomeDetailsForHoldingMock.mockResolvedValue(null);
  listActivitiesForHoldingMock.mockResolvedValue([]);
  listValuationsForHoldingMock.mockResolvedValue([]);
  listAccountsWithBalancesMock.mockResolvedValue([]);
  getMarketInstrumentByIdMock.mockResolvedValue(null);
  getPriceHistoryForInstrumentMock.mockResolvedValue([]);
});

async function renderPage() {
  const { default: HoldingDetailPage } =
    await import("@/app/app/investments/[holdingId]/page");
  return render(
    await HoldingDetailPage({
      params: Promise.resolve({ holdingId: "holding-1" }),
    }),
  );
}

describe("HoldingDetailPage", () => {
  it("redirects to login when there is no authenticated user", async () => {
    getAuthenticatedUserMock.mockResolvedValue(null);
    await expect(renderPage()).rejects.toThrow(/NEXT_REDIRECT/);
  });

  it("404s when the holding does not exist", async () => {
    getInvestmentHoldingByIdMock.mockResolvedValue(null);
    await expect(renderPage()).rejects.toThrow(/NEXT_NOT_FOUND/);
  });

  it("renders the market data link section for a mutual fund holding, with a fresh badge and no fabricated price chart", async () => {
    await renderPage();

    expect(screen.getByText("Market data link")).toBeInTheDocument();
    expect(screen.getByText(/AMFI NAV/)).toBeInTheDocument();
    expect(screen.getByText("Fresh")).toBeInTheDocument();
  });

  it("shows absolute return but not XIRR when there are no dated cash flows to solve", async () => {
    await renderPage();

    expect(screen.getByText("Performance")).toBeInTheDocument();
    expect(screen.getByText("Absolute return")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.queryByText("XIRR (money-weighted)")).not.toBeInTheDocument();
  });

  it("shows the NAV history chart once a market instrument is linked with price history", async () => {
    getInvestmentAssetByIdMock.mockResolvedValue(
      asset({ marketInstrumentId: "instrument-1" }),
    );
    getMarketInstrumentByIdMock.mockResolvedValue({
      id: "instrument-1",
      provider: "amfi",
      providerInstrumentId: "119551",
      symbol: null,
      exchange: null,
      mic: null,
      isin: "INF209KA12Z1",
      name: "Test Fund - Direct Plan - Growth",
      instrumentKind: "mutual_fund",
      quoteCurrency: "INR",
      timezone: "Asia/Kolkata",
      isActive: true,
      lastSuccessfulRefreshAt: "2026-08-20T12:00:00Z",
    });
    getPriceHistoryForInstrumentMock.mockResolvedValue([
      {
        id: "price-1",
        instrumentId: "instrument-1",
        priceKind: "nav",
        effectiveDate: "2026-08-19",
        price: new Decimal(105),
        currency: "INR",
        provider: "amfi",
        receivedAt: "2026-08-19T18:00:00Z",
        providerTimestamp: null,
        isCurrent: true,
      },
      {
        id: "price-2",
        instrumentId: "instrument-1",
        priceKind: "nav",
        effectiveDate: "2026-08-20",
        price: new Decimal(110),
        currency: "INR",
        provider: "amfi",
        receivedAt: "2026-08-20T18:00:00Z",
        providerTimestamp: null,
        isCurrent: true,
      },
    ]);

    await renderPage();

    expect(screen.getByRole("img", { hidden: true })).toBeInTheDocument();
    expect(screen.getAllByText(/NAV from/).length).toBeGreaterThan(0);
  });

  it("does not render the market-data section at all for a PPF holding", async () => {
    getInvestmentAssetByIdMock.mockResolvedValue(asset({ assetKind: "ppf" }));

    await renderPage();

    expect(screen.queryByText("Market data link")).not.toBeInTheDocument();
  });
});
