import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { getAuthenticatedUser } from "@/lib/auth/session";
import { Decimal } from "@/lib/money/decimal";
import type { getCapitalGainsReportForYear } from "@/lib/tax/capital-gains-data";
import type { CapitalGainLine } from "@/lib/tax/engine/capital-gains";
import type { listTaxAssetClassifications } from "@/lib/tax/queries";

const getAuthenticatedUserMock = vi.fn<typeof getAuthenticatedUser>();
vi.mock("@/lib/auth/session", () => ({
  getAuthenticatedUser: (...args: Parameters<typeof getAuthenticatedUser>) =>
    getAuthenticatedUserMock(...args),
}));

type HoldingRow = {
  id: string;
  investment_asset_id: string;
  investment_assets: { display_name: string; asset_kind: string } | null;
};

let holdingRows: HoldingRow[] = [];
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(() =>
    Promise.resolve({
      from: () => ({
        select: () => ({
          eq: () => Promise.resolve({ data: holdingRows }),
        }),
      }),
    }),
  ),
}));

const listTaxAssetClassificationsMock =
  vi.fn<typeof listTaxAssetClassifications>();
vi.mock("@/lib/tax/queries", () => ({
  listTaxAssetClassifications: (
    ...args: Parameters<typeof listTaxAssetClassifications>
  ) => listTaxAssetClassificationsMock(...args),
}));

const getCapitalGainsReportForYearMock =
  vi.fn<typeof getCapitalGainsReportForYear>();
vi.mock("@/lib/tax/capital-gains-data", () => ({
  getCapitalGainsReportForYear: (
    ...args: Parameters<typeof getCapitalGainsReportForYear>
  ) => getCapitalGainsReportForYearMock(...args),
}));

// TaxAssetClassificationForm (rendered for each unclassified holding) is a
// real, unmocked client component that imports saveTaxAssetClassificationAction
// from "@/lib/tax/actions" — a "use server" module carrying `import
// "server-only"` at its top, which throws unconditionally when actually
// loaded outside a real Next.js server bundle. Stubbing the action here
// keeps the real actions.ts module (and everything server-only it pulls
// in) out of this test entirely.
vi.mock("@/lib/tax/actions", () => ({
  saveTaxAssetClassificationAction: vi.fn(),
}));

const redirectMock = vi.fn((url: string): never => {
  throw Object.assign(new Error(`NEXT_REDIRECT:${url}`), {
    digest: `NEXT_REDIRECT;push;${url};307;`,
  });
});
const notFoundMock = vi.fn((): never => {
  throw Object.assign(new Error("NEXT_NOT_FOUND"), {
    digest: "NEXT_NOT_FOUND",
  });
});
vi.mock("next/navigation", () => ({
  redirect: redirectMock,
  notFound: notFoundMock,
}));

function line(overrides: Partial<CapitalGainLine> = {}): CapitalGainLine {
  return {
    disposalActivityId: "sell1",
    lotId: "lot:buy1",
    holdingId: "holding1",
    assetClass: "listed_equity",
    displayName: "Example Corp",
    isinOrSymbol: "INE000A00000",
    acquisitionDate: "2022-01-01",
    disposalDate: "2025-09-01",
    holdingPeriodDays: 1339,
    term: "long_term",
    quantity: new Decimal(10),
    grossProceeds: new Decimal(1500),
    acquisitionCost: new Decimal(1000),
    transferExpenses: new Decimal(10),
    rawGain: new Decimal(490),
    ratePercent: new Decimal(12.5),
    ruleMatched: true,
    ...overrides,
  };
}

function emptyReport() {
  return {
    lines: [] as CapitalGainLine[],
    categoryTotals: [],
    ltcgExemptionApplied: new Decimal(0),
    ltcgTaxableAfterExemption: new Decimal(0),
    ltcgSpecialRateTax: new Decimal(0),
    stcgSpecialRateTax: new Decimal(0),
    totalGains: new Decimal(0),
    totalLosses: new Decimal(0),
    unclassifiedOrUnsupportedCount: 0,
    status: "complete" as const,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  holdingRows = [];
  getAuthenticatedUserMock.mockResolvedValue({
    id: "user-1",
    email: "asha@example.com",
  });
  listTaxAssetClassificationsMock.mockResolvedValue([]);
  getCapitalGainsReportForYearMock.mockResolvedValue({
    report: emptyReport(),
    unclassifiedHoldingCount: 0,
    mixedCurrencyHoldingCount: 0,
  });
});

async function renderPage(financialYear: string) {
  const { default: CapitalGainsPage } =
    await import("@/app/app/tax/[financialYear]/capital-gains/page");
  return render(
    await CapitalGainsPage({ params: Promise.resolve({ financialYear }) }),
  );
}

describe("CapitalGainsPage — rule-set availability", () => {
  it("shows an unavailable state for a financial year with no registered rule set", async () => {
    await renderPage("2026-27");
    expect(
      screen.getByText("Unavailable for this financial year"),
    ).toBeInTheDocument();
    expect(getCapitalGainsReportForYearMock).not.toHaveBeenCalled();
  });

  it("redirects unauthenticated visitors to login", async () => {
    getAuthenticatedUserMock.mockResolvedValue(null);
    await expect(renderPage("2025-26")).rejects.toThrow(/NEXT_REDIRECT/);
  });
});

describe("CapitalGainsPage — disposal lines: STCG and LTCG", () => {
  it("shows a long-term disposal line with its matched rate", async () => {
    getCapitalGainsReportForYearMock.mockResolvedValue({
      report: {
        ...emptyReport(),
        lines: [line({ term: "long_term" })],
        totalGains: new Decimal(490),
      },
      unclassifiedHoldingCount: 0,
      mixedCurrencyHoldingCount: 0,
    });
    await renderPage("2025-26");
    expect(screen.getByText("Example Corp (INE000A00000)")).toBeInTheDocument();
    expect(screen.getByText(/long_term/)).toBeInTheDocument();
    expect(screen.getByText(/rate 12.5%/)).toBeInTheDocument();
  });

  it("shows a short-term disposal line distinctly from a long-term one", async () => {
    getCapitalGainsReportForYearMock.mockResolvedValue({
      report: {
        ...emptyReport(),
        lines: [
          line({
            disposalActivityId: "sell-short",
            lotId: "lot:short",
            displayName: "Short Corp",
            isinOrSymbol: "INE111A00000",
            term: "short_term",
            acquisitionDate: "2025-06-01",
          }),
        ],
      },
      unclassifiedHoldingCount: 0,
      mixedCurrencyHoldingCount: 0,
    });
    await renderPage("2025-26");
    expect(screen.getByText(/short_term/)).toBeInTheDocument();
  });

  it("shows acquisition and disposal dates as evidence for each line", async () => {
    getCapitalGainsReportForYearMock.mockResolvedValue({
      report: { ...emptyReport(), lines: [line()] },
      unclassifiedHoldingCount: 0,
      mixedCurrencyHoldingCount: 0,
    });
    await renderPage("2025-26");
    expect(screen.getByText(/acquired 2022-01-01/)).toBeInTheDocument();
    expect(screen.getByText(/disposed 2025-09-01/)).toBeInTheDocument();
  });

  it("flags a line with no matched rate rule as needing review, rather than a guessed rate", async () => {
    getCapitalGainsReportForYearMock.mockResolvedValue({
      report: {
        ...emptyReport(),
        lines: [line({ ruleMatched: false, ratePercent: null })],
        status: "partial",
      },
      unclassifiedHoldingCount: 0,
      mixedCurrencyHoldingCount: 0,
    });
    await renderPage("2025-26");
    expect(
      screen.getByText(/no rate rule matched — needs review/),
    ).toBeInTheDocument();
  });
});

describe("CapitalGainsPage — unsupported-adjustment and unclassified handling", () => {
  it("shows the unclassified-holding count and offers a classification form for each", async () => {
    holdingRows = [
      {
        id: "holding-1",
        investment_asset_id: "asset-1",
        investment_assets: {
          display_name: "Mystery Fund",
          asset_kind: "mutual_fund",
        },
      },
    ];
    getCapitalGainsReportForYearMock.mockResolvedValue({
      report: emptyReport(),
      unclassifiedHoldingCount: 1,
      mixedCurrencyHoldingCount: 0,
    });
    await renderPage("2025-26");
    expect(
      screen.getByText(/1 holding\(s\) not yet classified/),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Holdings needing classification"),
    ).toBeInTheDocument();
    expect(screen.getByText("Mystery Fund")).toBeInTheDocument();
  });

  it("excludes a needs-review disposal's gain from the report entirely rather than fabricating a figure", async () => {
    getCapitalGainsReportForYearMock.mockResolvedValue({
      report: {
        ...emptyReport(),
        lines: [],
        unclassifiedOrUnsupportedCount: 1,
        status: "partial",
      },
      unclassifiedHoldingCount: 0,
      mixedCurrencyHoldingCount: 0,
    });
    await renderPage("2025-26");
    expect(
      screen.getByText("No disposals this financial year"),
    ).toBeInTheDocument();
  });
});

describe("CapitalGainsPage — mixed-currency holdings", () => {
  it("shows a visible warning and excludes the holding, with zero fabricated gain, for a mixed-currency holding", async () => {
    getCapitalGainsReportForYearMock.mockResolvedValue({
      report: { ...emptyReport(), status: "partial" },
      unclassifiedHoldingCount: 0,
      mixedCurrencyHoldingCount: 1,
    });
    await renderPage("2025-26");

    expect(
      screen.getByText(
        /1 holding\(s\) excluded — activities recorded in more than one currency, unavailable rather than guessed/,
      ),
    ).toBeInTheDocument();
    // No disposal line exists for the mixed-currency holding — nothing to
    // point at as a "gain", proving no figure was fabricated.
    expect(
      screen.getByText("No disposals this financial year"),
    ).toBeInTheDocument();
  });

  it("shows overall status as partial, never complete, when a mixed-currency holding is excluded", async () => {
    getCapitalGainsReportForYearMock.mockResolvedValue({
      report: { ...emptyReport(), status: "partial" },
      unclassifiedHoldingCount: 0,
      mixedCurrencyHoldingCount: 1,
    });
    await renderPage("2025-26");
    expect(screen.getByText(/status\s*partial/)).toBeInTheDocument();
  });
});

describe("CapitalGainsPage — never presents Phase 7's weighted-average cost basis as the tax-lot basis", () => {
  it("states explicitly that FIFO tax lots are independent of the portfolio's weighted-average accounting cost basis", async () => {
    await renderPage("2025-26");
    expect(
      screen.getByText(
        /independently of your portfolio's weighted-average accounting cost basis/,
      ),
    ).toBeInTheDocument();
  });

  it("mentions weighted-average exactly once (the page-level disclaimer), never again next to a disposal line's own cost figure", async () => {
    getCapitalGainsReportForYearMock.mockResolvedValue({
      report: { ...emptyReport(), lines: [line()] },
      unclassifiedHoldingCount: 0,
      mixedCurrencyHoldingCount: 0,
    });
    await renderPage("2025-26");
    expect(screen.getAllByText(/weighted-average/i)).toHaveLength(1);
  });
});
