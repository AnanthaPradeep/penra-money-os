import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { getAuthenticatedUser } from "@/lib/auth/session";
import { Decimal } from "@/lib/money/decimal";
import type { RegimeComparisonResult } from "@/lib/tax/engine/regime-comparison";
import type { getRegimeComparisonForYear } from "@/lib/tax/regime-comparison-data";

const getAuthenticatedUserMock = vi.fn<typeof getAuthenticatedUser>();
vi.mock("@/lib/auth/session", () => ({
  getAuthenticatedUser: (...args: Parameters<typeof getAuthenticatedUser>) =>
    getAuthenticatedUserMock(...args),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(() => Promise.resolve({})),
}));

const getRegimeComparisonForYearMock =
  vi.fn<typeof getRegimeComparisonForYear>();
vi.mock("@/lib/tax/regime-comparison-data", () => ({
  getRegimeComparisonForYear: (
    ...args: Parameters<typeof getRegimeComparisonForYear>
  ) => getRegimeComparisonForYearMock(...args),
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

function estimate(
  overrides: Partial<RegimeComparisonResult["old"]> = {},
): RegimeComparisonResult["old"] {
  return {
    regime: "old",
    status: "available",
    grossOrdinaryIncome: new Decimal(1000000),
    standardDeduction: new Decimal(50000),
    deductionsApplied: new Decimal(150000),
    taxableOrdinaryIncome: new Decimal(800000),
    ordinaryTax: {
      status: "available",
      regime: "old",
      financialYearId: "2025-26",
      assessmentYearId: "2026-27",
      ruleSetVersion: "in-individual-2025-26.v1",
      taxableOrdinaryIncome: new Decimal(800000),
      slabBreakdown: [],
      slabTax: new Decimal(70000),
      rebateApplied: new Decimal(0),
      taxAfterRebate: new Decimal(70000),
      surchargeApplied: new Decimal(0),
      cessApplied: new Decimal(2800),
      totalOrdinaryTax: new Decimal(72800),
      reasonCodes: [],
      calculatedAt: "2026-08-27T12:00:00.000Z",
    },
    specialRateTax: new Decimal(0),
    totalTaxLiability: new Decimal(72800),
    taxAlreadyPaid: new Decimal(60000),
    balancePayableOrRefund: new Decimal(12800),
    ...overrides,
  };
}

function comparisonResult(
  overrides: Partial<RegimeComparisonResult> = {},
): RegimeComparisonResult {
  return {
    financialYearId: "2025-26",
    assessmentYearId: "2026-27",
    ruleSetVersion: "in-individual-2025-26.v1",
    calculatedAt: "2026-08-27T12:00:00.000Z",
    old: estimate(),
    new: estimate({ regime: "new", totalTaxLiability: new Decimal(65000) }),
    differenceOldMinusNew: new Decimal(7800),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  getAuthenticatedUserMock.mockResolvedValue({
    id: "user-1",
    email: "asha@example.com",
  });
});

async function renderPage(financialYear = "2025-26") {
  const { default: CompareRegimesPage } =
    await import("@/app/app/tax/[financialYear]/compare/page");
  return render(
    await CompareRegimesPage({ params: Promise.resolve({ financialYear }) }),
  );
}

describe("CompareRegimesPage — neutral presentation", () => {
  it("shows both regimes side by side with no recommendation language anywhere on the page", async () => {
    getRegimeComparisonForYearMock.mockResolvedValue({
      available: true,
      result: comparisonResult(),
      hasSalaryOrPensionIncome: true,
    });
    await renderPage();

    expect(screen.getByText("Old regime")).toBeInTheDocument();
    expect(screen.getByText("New regime")).toBeInTheDocument();

    const bodyText = document.body.textContent ?? "";
    for (const forbidden of [
      "best",
      "recommended",
      "you should choose",
      "better regime",
      "optimal regime",
    ]) {
      expect(bodyText.toLowerCase()).not.toContain(forbidden.toLowerCase());
    }
  });

  it("presents the difference as a signed arithmetic fact, explicitly not a recommendation", async () => {
    getRegimeComparisonForYearMock.mockResolvedValue({
      available: true,
      result: comparisonResult(),
      hasSalaryOrPensionIncome: true,
    });
    await renderPage();

    expect(screen.getByText(/it is not a recommendation/)).toBeInTheDocument();
  });

  it("never exposes a field or label shaped like 'best'/'recommended' in the underlying data contract", () => {
    const result = comparisonResult();
    expect(Object.keys(result)).not.toContain("recommendedRegime");
    expect(Object.keys(result)).not.toContain("bestRegime");
  });
});

describe("CompareRegimesPage — figures shown", () => {
  it("shows gross ordinary income, ordinary tax, capital-gains tax, and total liability for each regime", async () => {
    getRegimeComparisonForYearMock.mockResolvedValue({
      available: true,
      result: comparisonResult(),
      hasSalaryOrPensionIncome: true,
    });
    await renderPage();

    expect(screen.getAllByText("Taxable ordinary income")).toHaveLength(2);
    expect(screen.getAllByText("Ordinary tax + cess")).toHaveLength(2);
    expect(screen.getAllByText("Capital-gains tax")).toHaveLength(2);
    expect(screen.getAllByText("Total estimated liability")).toHaveLength(2);
  });

  it("labels a positive balance as payable and a negative balance as a refund", async () => {
    getRegimeComparisonForYearMock.mockResolvedValue({
      available: true,
      result: comparisonResult({
        old: estimate({ balancePayableOrRefund: new Decimal(-500) }),
      }),
      hasSalaryOrPensionIncome: true,
    });
    await renderPage();

    expect(screen.getByText("Estimated refund")).toBeInTheDocument();
  });
});

describe("CompareRegimesPage — availability states", () => {
  it("shows a partial-status warning naming the surcharge limitation, never an approximated number", async () => {
    getRegimeComparisonForYearMock.mockResolvedValue({
      available: true,
      result: comparisonResult({
        old: estimate({ status: "partial" }),
      }),
      hasSalaryOrPensionIncome: true,
    });
    await renderPage();

    expect(
      screen.getByText(/surcharge above ₹50,00,000 is not yet supported/),
    ).toBeInTheDocument();
  });

  it("shows an unavailable state naming the missing profile, offering a link to set one up", async () => {
    getRegimeComparisonForYearMock.mockResolvedValue({
      available: false,
      reasonCode: "no_profile",
    });
    await renderPage();

    expect(
      screen.getByText("Set up your tax profile first."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Go to tax profile" }),
    ).toHaveAttribute("href", "/app/tax/profile");
  });

  it("shows an unavailable state naming out-of-scope profile for an unsupported profile", async () => {
    getRegimeComparisonForYearMock.mockResolvedValue({
      available: false,
      reasonCode: "unsupported_profile",
    });
    await renderPage();

    expect(
      screen.getByText(/outside this workspace's supported scope/),
    ).toBeInTheDocument();
  });

  it("shows an unavailable state for a financial year with no registered rule set, without calling the comparison engine", async () => {
    await renderPage("2026-27");
    expect(
      screen.getByText("Unavailable for this financial year"),
    ).toBeInTheDocument();
    expect(getRegimeComparisonForYearMock).not.toHaveBeenCalled();
  });
});
