import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { getAuthenticatedUser } from "@/lib/auth/session";
import type {
  getAllocationByKind,
  getHoldingSummaries,
  getPortfolioSummaries,
  getPpfFinancialYearSummary,
  getUpcomingMaturityEvents,
} from "@/lib/investments/queries";
import { Decimal } from "@/lib/money/decimal";

const getAuthenticatedUserMock = vi.fn<typeof getAuthenticatedUser>();
vi.mock("@/lib/auth/session", () => ({
  getAuthenticatedUser: (...args: Parameters<typeof getAuthenticatedUser>) =>
    getAuthenticatedUserMock(...args),
}));

const getHoldingSummariesMock = vi.fn<typeof getHoldingSummaries>();
const getPortfolioSummariesMock = vi.fn<typeof getPortfolioSummaries>();
const getAllocationByKindMock = vi.fn<typeof getAllocationByKind>();
const getUpcomingMaturityEventsMock = vi.fn<typeof getUpcomingMaturityEvents>();
const getPpfFinancialYearSummaryMock =
  vi.fn<typeof getPpfFinancialYearSummary>();
vi.mock("@/lib/investments/queries", () => ({
  getHoldingSummaries: (...args: Parameters<typeof getHoldingSummaries>) =>
    getHoldingSummariesMock(...args),
  getPortfolioSummaries: (...args: Parameters<typeof getPortfolioSummaries>) =>
    getPortfolioSummariesMock(...args),
  getPrimaryPortfolioSummary: async (
    ...args: Parameters<typeof getPortfolioSummaries>
  ) => {
    const summaries = await getPortfolioSummariesMock(...args);
    return (
      summaries.find((s) => s.currency === "INR") ?? {
        currency: "INR",
        totalInvestedCost: new Decimal(0),
        totalCurrentValue: new Decimal(0),
        totalUnrealizedGain: new Decimal(0),
        totalRealizedGain: new Decimal(0),
        totalIncomeReceived: new Decimal(0),
        activeHoldingsCount: 0,
        missingValuationCount: 0,
      }
    );
  },
  getAllocationByKind: (...args: Parameters<typeof getAllocationByKind>) =>
    getAllocationByKindMock(...args),
  getUpcomingMaturityEvents: (
    ...args: Parameters<typeof getUpcomingMaturityEvents>
  ) => getUpcomingMaturityEventsMock(...args),
  getPpfFinancialYearSummary: (
    ...args: Parameters<typeof getPpfFinancialYearSummary>
  ) => getPpfFinancialYearSummaryMock(...args),
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
}));

beforeEach(() => {
  vi.clearAllMocks();
  getAuthenticatedUserMock.mockResolvedValue({
    id: "user-1",
    email: "asha@example.com",
  });
  getHoldingSummariesMock.mockResolvedValue([]);
  getPortfolioSummariesMock.mockResolvedValue([]);
  getAllocationByKindMock.mockResolvedValue([]);
  getUpcomingMaturityEventsMock.mockResolvedValue([]);
  getPpfFinancialYearSummaryMock.mockResolvedValue([]);
});

async function renderPage() {
  const { default: InvestmentsPage } =
    await import("@/app/app/investments/page");
  return render(await InvestmentsPage());
}

describe("InvestmentsPage", () => {
  it("redirects to login when there is no authenticated user", async () => {
    getAuthenticatedUserMock.mockResolvedValue(null);

    await expect(renderPage()).rejects.toThrow(/NEXT_REDIRECT/);
  });

  it("shows an empty state with no holdings", async () => {
    await renderPage();

    expect(screen.getByText("Track your first investment")).toBeInTheDocument();
    const links = screen.getAllByRole("link", { name: /new investment/i });
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(link).toHaveAttribute("href", "/app/investments/new");
    }
  });

  it("shows portfolio totals, missing-valuation warning, and holdings once data exists", async () => {
    getHoldingSummariesMock.mockResolvedValue([
      {
        holdingId: "holding-1",
        investmentAssetId: "asset-1",
        assetKind: "stock",
        displayName: "HDFC Bank Ltd",
        symbol: "HDFCBANK",
        currency: "INR",
        status: "active",
        quantity: new Decimal(10),
        avgUnitCost: new Decimal(100),
        costBasis: new Decimal(1000),
        hasValuation: false,
        latestValuation: null,
        latestValuationAt: null,
        currentValue: new Decimal(1000),
        unrealizedGain: null,
        realizedGain: new Decimal(0),
        incomeReceived: new Decimal(0),
      },
    ]);
    getPortfolioSummariesMock.mockResolvedValue([
      {
        currency: "INR",
        totalInvestedCost: new Decimal(1000),
        totalCurrentValue: new Decimal(1000),
        totalUnrealizedGain: new Decimal(0),
        totalRealizedGain: new Decimal(0),
        totalIncomeReceived: new Decimal(0),
        activeHoldingsCount: 1,
        missingValuationCount: 1,
      },
    ]);

    await renderPage();

    expect(screen.getByText("HDFC Bank Ltd")).toBeInTheDocument();
    expect(
      screen.getByText(/1 holding has no manual valuation/),
    ).toBeInTheDocument();
    expect(screen.getByText("1 active holding")).toBeInTheDocument();
  });

  it("does not show a missing-valuation warning when every holding is valued", async () => {
    getPortfolioSummariesMock.mockResolvedValue([
      {
        currency: "INR",
        totalInvestedCost: new Decimal(1000),
        totalCurrentValue: new Decimal(1200),
        totalUnrealizedGain: new Decimal(200),
        totalRealizedGain: new Decimal(0),
        totalIncomeReceived: new Decimal(0),
        activeHoldingsCount: 1,
        missingValuationCount: 0,
      },
    ]);
    getHoldingSummariesMock.mockResolvedValue([
      {
        holdingId: "holding-1",
        investmentAssetId: "asset-1",
        assetKind: "stock",
        displayName: "HDFC Bank Ltd",
        symbol: null,
        currency: "INR",
        status: "active",
        quantity: new Decimal(10),
        avgUnitCost: new Decimal(100),
        costBasis: new Decimal(1000),
        hasValuation: true,
        latestValuation: new Decimal(1200),
        latestValuationAt: "2026-08-01T00:00:00Z",
        currentValue: new Decimal(1200),
        unrealizedGain: new Decimal(200),
        realizedGain: new Decimal(0),
        incomeReceived: new Decimal(0),
      },
    ]);

    await renderPage();

    expect(screen.queryByText(/no manual valuation/)).not.toBeInTheDocument();
  });
});
