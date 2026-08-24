import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { getAuthenticatedUser } from "@/lib/auth/session";
import type {
  getHoldingSummaries,
  listInvestmentAssets,
} from "@/lib/investments/queries";
import type {
  HoldingSummary,
  InvestmentAsset,
} from "@/lib/investments/mapping";
import type { getMarketDataProviderStates } from "@/lib/market-data/queries";
import type { MarketDataProviderState } from "@/lib/market-data/mapping";
import { Decimal } from "@/lib/money/decimal";

const getAuthenticatedUserMock = vi.fn<typeof getAuthenticatedUser>();
vi.mock("@/lib/auth/session", () => ({
  getAuthenticatedUser: (...args: Parameters<typeof getAuthenticatedUser>) =>
    getAuthenticatedUserMock(...args),
}));

const listInvestmentAssetsMock = vi.fn<typeof listInvestmentAssets>();
const getHoldingSummariesMock = vi.fn<typeof getHoldingSummaries>();
vi.mock("@/lib/investments/queries", () => ({
  listInvestmentAssets: (...args: Parameters<typeof listInvestmentAssets>) =>
    listInvestmentAssetsMock(...args),
  getHoldingSummaries: (...args: Parameters<typeof getHoldingSummaries>) =>
    getHoldingSummariesMock(...args),
}));

const getMarketDataProviderStatesMock =
  vi.fn<typeof getMarketDataProviderStates>();
vi.mock("@/lib/market-data/queries", () => ({
  getMarketDataProviderStates: (
    ...args: Parameters<typeof getMarketDataProviderStates>
  ) => getMarketDataProviderStatesMock(...args),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(() => Promise.resolve({})),
}));

const redirectMock = vi.fn((url: string): never => {
  throw Object.assign(new Error(`NEXT_REDIRECT:${url}`), {
    digest: `NEXT_REDIRECT;push;${url};307;`,
  });
});
vi.mock("next/navigation", () => ({
  redirect: redirectMock,
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

function holding(overrides: Partial<HoldingSummary>): HoldingSummary {
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

function providerState(
  overrides: Partial<MarketDataProviderState>,
): MarketDataProviderState {
  return {
    provider: "amfi",
    isConfigured: true,
    lastSuccessAt: "2026-08-20T12:00:00Z",
    lastAttemptAt: "2026-08-20T12:00:00Z",
    lastErrorCode: null,
    consecutiveFailures: 0,
    notes: null,
    updatedAt: "2026-08-20T12:00:00Z",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  getAuthenticatedUserMock.mockResolvedValue({
    id: "user-1",
    email: "asha@example.com",
  });
  listInvestmentAssetsMock.mockResolvedValue([]);
  getHoldingSummariesMock.mockResolvedValue([]);
  getMarketDataProviderStatesMock.mockResolvedValue([]);
});

async function renderPage() {
  const { default: MarketDataSettingsPage } =
    await import("@/app/app/settings/market-data/page");
  return render(await MarketDataSettingsPage());
}

describe("MarketDataSettingsPage", () => {
  it("redirects to login when there is no authenticated user", async () => {
    getAuthenticatedUserMock.mockResolvedValue(null);

    await expect(renderPage()).rejects.toThrow(/NEXT_REDIRECT/);
  });

  it("always discloses that data is delayed, never live", async () => {
    await renderPage();

    expect(
      screen.getByText(/Every price here is delayed, not live/),
    ).toBeInTheDocument();
  });

  it("shows provider health for both amfi and twelve_data", async () => {
    getMarketDataProviderStatesMock.mockResolvedValue([
      providerState({ provider: "amfi", isConfigured: true }),
      providerState({
        provider: "twelve_data",
        isConfigured: false,
        lastSuccessAt: null,
        notes: "No API key configured in this environment.",
      }),
    ]);

    await renderPage();

    expect(
      screen.getByText("AMFI (official mutual-fund NAV)"),
    ).toBeInTheDocument();
    expect(screen.getByText("Twelve Data (stock prices)")).toBeInTheDocument();
    expect(
      screen.getByText("Not configured in this environment."),
    ).toBeInTheDocument();
  });

  it("counts linked vs. missing-mapping holdings without conflating stock/mutual_fund with PPF/FD/RD", async () => {
    listInvestmentAssetsMock.mockResolvedValue([
      asset({ id: "a1", assetKind: "mutual_fund", marketInstrumentId: "mi-1" }),
      asset({ id: "a2", assetKind: "stock", marketInstrumentId: null }),
      asset({ id: "a3", assetKind: "ppf", marketInstrumentId: null }),
    ]);

    await renderPage();

    expect(screen.getByText("1 / 2")).toBeInTheDocument();
    expect(
      screen.getByText(/1 holding needs a scheme\/symbol link/),
    ).toBeInTheDocument();
  });

  it("counts stale/delayed holdings from the live holding summaries", async () => {
    getHoldingSummariesMock.mockResolvedValue([
      holding({ holdingId: "h1", priceStatus: "fresh" }),
      holding({ holdingId: "h2", priceStatus: "stale" }),
      holding({ holdingId: "h3", priceStatus: "delayed" }),
    ]);

    await renderPage();

    const staleCard = screen
      .getByText("Stale or delayed prices")
      .closest("div");
    expect(staleCard).toHaveTextContent("2");
  });

  it("renders the manual refresh control", async () => {
    await renderPage();

    expect(
      screen.getByRole("button", { name: /Refresh my linked holdings/ }),
    ).toBeInTheDocument();
  });
});
