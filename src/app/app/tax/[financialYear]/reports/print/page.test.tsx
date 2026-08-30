import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { getAuthenticatedUser } from "@/lib/auth/session";
import type { getTaxReviewPackData } from "@/lib/tax/print-pack";
import { FY_2025_26 } from "@/lib/tax/rules/fy2025-26";

const getAuthenticatedUserMock = vi.fn<typeof getAuthenticatedUser>();
vi.mock("@/lib/auth/session", () => ({
  getAuthenticatedUser: (...args: Parameters<typeof getAuthenticatedUser>) =>
    getAuthenticatedUserMock(...args),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(() => Promise.resolve({})),
}));

const getTaxReviewPackDataMock = vi.fn<typeof getTaxReviewPackData>();
vi.mock("@/lib/tax/print-pack", () => ({
  getTaxReviewPackData: (...args: Parameters<typeof getTaxReviewPackData>) =>
    getTaxReviewPackDataMock(...args),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw Object.assign(new Error(`NEXT_REDIRECT:${url}`), {
      digest: `NEXT_REDIRECT;push;${url};307;`,
    });
  }),
  notFound: vi.fn(() => {
    throw Object.assign(new Error("NEXT_NOT_FOUND"), {
      digest: "NEXT_NOT_FOUND",
    });
  }),
}));

function baseData(
  overrides: Partial<Awaited<ReturnType<typeof getTaxReviewPackData>>> = {},
): Awaited<ReturnType<typeof getTaxReviewPackData>> {
  return {
    financialYear: {
      id: "2025-26",
      startYear: 2025,
      startDate: "2025-04-01",
      endDate: "2026-03-31",
      label: "FY 2025-26",
      assessmentYearId: "2026-27",
      assessmentYearLabel: "AY 2026-27",
    },
    ruleSetLookup: {
      available: false,
      reasonCode: "no_rule_set_for_financial_year",
    },
    profile: null,
    incomeAdjustments: [],
    deductions: [],
    withholdings: [],
    payments: [],
    reconciliationItems: [],
    capitalGains: null,
    regimeComparison: null,
    generatedAt: "2026-08-27T12:00:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  getAuthenticatedUserMock.mockResolvedValue({
    id: "user-1",
    email: "asha@example.com",
  });
  getTaxReviewPackDataMock.mockResolvedValue(baseData());
});

async function renderPage(financialYear = "2025-26") {
  const { default: TaxReviewPackPrintPage } =
    await import("@/app/app/tax/[financialYear]/reports/print/page");
  return render(
    await TaxReviewPackPrintPage({
      params: Promise.resolve({ financialYear }),
    }),
  );
}

describe("TaxReviewPackPrintPage — required header content", () => {
  it("shows the financial year, assessment year, generated timestamp, and disclaimer", async () => {
    await renderPage();
    expect(screen.getByText("FY 2025-26 (AY 2026-27)")).toBeInTheDocument();
    expect(
      screen.getAllByText(/not an income-tax return/).length,
    ).toBeGreaterThan(0);
  });

  it("shows the rule-set version when available", async () => {
    getTaxReviewPackDataMock.mockResolvedValue(
      baseData({
        ruleSetLookup: { available: true, ruleSet: FY_2025_26 },
      }),
    );
    await renderPage();
    expect(screen.getByText(FY_2025_26.ruleSetVersion)).toBeInTheDocument();
  });
});

describe("TaxReviewPackPrintPage — sections", () => {
  it("shows section headings for income, capital gains, deductions, TDS/payments, reconciliation, and the regime comparison", async () => {
    await renderPage();
    expect(screen.getByText("Income")).toBeInTheDocument();
    expect(screen.getByText("Capital gains")).toBeInTheDocument();
    expect(screen.getByText("Deductions")).toBeInTheDocument();
    expect(screen.getByText("TDS/TCS and payments")).toBeInTheDocument();
    expect(screen.getByText("AIS/26AS reconciliation")).toBeInTheDocument();
    expect(
      screen.getByText("Old vs new regime (neutral comparison)"),
    ).toBeInTheDocument();
  });

  it("shows a print action hint that is not part of the printed content itself", async () => {
    await renderPage();
    expect(screen.getByText(/Save as PDF/i)).toBeInTheDocument();
  });
});

describe("TaxReviewPackPrintPage — partial and unavailable states", () => {
  it("lists a warning when no rule set is published for the year", async () => {
    await renderPage();
    expect(
      screen.getByText("Warnings / unsupported items"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/No versioned tax rule set is published for FY 2025-26/),
    ).toBeInTheDocument();
  });

  it("shows capital gains as unavailable when there is no rule set, rather than a guessed figure", async () => {
    await renderPage();
    expect(
      screen.getByText(
        "Unavailable — no versioned rule set for this financial year.",
      ),
    ).toBeInTheDocument();
  });

  it("shows the regime comparison as unavailable and explicitly non-recommending when unavailable", async () => {
    await renderPage();
    expect(
      screen.getByText(/is never a recommendation of either regime/),
    ).toBeInTheDocument();
  });
});

describe("TaxReviewPackPrintPage — access control", () => {
  it("redirects unauthenticated visitors to login", async () => {
    getAuthenticatedUserMock.mockResolvedValue(null);
    await expect(renderPage()).rejects.toThrow(/NEXT_REDIRECT/);
  });

  it("rejects a malformed financial-year id", async () => {
    await expect(renderPage("bad-year")).rejects.toThrow(/NEXT_NOT_FOUND/);
  });
});
