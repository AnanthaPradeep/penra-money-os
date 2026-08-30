import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { getAuthenticatedUser } from "@/lib/auth/session";
import { Decimal } from "@/lib/money/decimal";
import type {
  getLatestDraftTaxReportSnapshot,
  getLatestFinalizedTaxReportSnapshot,
  getTaxProfile,
  listTaxDeductions,
  listTaxIncomeAdjustments,
  listTaxPayments,
  listTaxReconciliationItems,
  listTaxWithholdings,
} from "@/lib/tax/queries";

const getAuthenticatedUserMock = vi.fn<typeof getAuthenticatedUser>();
vi.mock("@/lib/auth/session", () => ({
  getAuthenticatedUser: (...args: Parameters<typeof getAuthenticatedUser>) =>
    getAuthenticatedUserMock(...args),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(() => Promise.resolve({})),
}));

const getTaxProfileMock = vi.fn<typeof getTaxProfile>();
const listTaxIncomeAdjustmentsMock = vi.fn<typeof listTaxIncomeAdjustments>();
const listTaxDeductionsMock = vi.fn<typeof listTaxDeductions>();
const listTaxWithholdingsMock = vi.fn<typeof listTaxWithholdings>();
const listTaxPaymentsMock = vi.fn<typeof listTaxPayments>();
const listTaxReconciliationItemsMock =
  vi.fn<typeof listTaxReconciliationItems>();
const getLatestFinalizedTaxReportSnapshotMock =
  vi.fn<typeof getLatestFinalizedTaxReportSnapshot>();
const getLatestDraftTaxReportSnapshotMock =
  vi.fn<typeof getLatestDraftTaxReportSnapshot>();
vi.mock("@/lib/tax/queries", () => ({
  getTaxProfile: (...args: Parameters<typeof getTaxProfile>) =>
    getTaxProfileMock(...args),
  listTaxIncomeAdjustments: (
    ...args: Parameters<typeof listTaxIncomeAdjustments>
  ) => listTaxIncomeAdjustmentsMock(...args),
  listTaxDeductions: (...args: Parameters<typeof listTaxDeductions>) =>
    listTaxDeductionsMock(...args),
  listTaxWithholdings: (...args: Parameters<typeof listTaxWithholdings>) =>
    listTaxWithholdingsMock(...args),
  listTaxPayments: (...args: Parameters<typeof listTaxPayments>) =>
    listTaxPaymentsMock(...args),
  listTaxReconciliationItems: (
    ...args: Parameters<typeof listTaxReconciliationItems>
  ) => listTaxReconciliationItemsMock(...args),
  getLatestFinalizedTaxReportSnapshot: (
    ...args: Parameters<typeof getLatestFinalizedTaxReportSnapshot>
  ) => getLatestFinalizedTaxReportSnapshotMock(...args),
  getLatestDraftTaxReportSnapshot: (
    ...args: Parameters<typeof getLatestDraftTaxReportSnapshot>
  ) => getLatestDraftTaxReportSnapshotMock(...args),
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
  useRouter: () => ({ push: vi.fn() }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  getAuthenticatedUserMock.mockResolvedValue({
    id: "user-1",
    email: "asha@example.com",
  });
  getTaxProfileMock.mockResolvedValue(null);
  listTaxIncomeAdjustmentsMock.mockResolvedValue([]);
  listTaxDeductionsMock.mockResolvedValue([]);
  listTaxWithholdingsMock.mockResolvedValue([]);
  listTaxPaymentsMock.mockResolvedValue([]);
  listTaxReconciliationItemsMock.mockResolvedValue([]);
  getLatestFinalizedTaxReportSnapshotMock.mockResolvedValue(null);
  getLatestDraftTaxReportSnapshotMock.mockResolvedValue(null);
});

async function renderPage(financialYear: string) {
  const { default: TaxWorkspacePage } =
    await import("@/app/app/tax/[financialYear]/page");
  return render(
    await TaxWorkspacePage({ params: Promise.resolve({ financialYear }) }),
  );
}

describe("TaxWorkspacePage — routing and access", () => {
  it("rejects a malformed financial-year id with notFound, never rendering the workspace", async () => {
    await expect(renderPage("not-a-year")).rejects.toThrow(/NEXT_NOT_FOUND/);
    expect(notFoundMock).toHaveBeenCalled();
  });

  it("rejects a non-consecutive financial-year id (e.g. 2025-30) with notFound", async () => {
    await expect(renderPage("2025-30")).rejects.toThrow(/NEXT_NOT_FOUND/);
  });

  it("redirects to login when there is no authenticated user", async () => {
    getAuthenticatedUserMock.mockResolvedValue(null);
    await expect(renderPage("2025-26")).rejects.toThrow(/NEXT_REDIRECT/);
    expect(redirectMock).toHaveBeenCalledWith("/login?next=/app/tax/2025-26");
  });
});

describe("TaxWorkspacePage — rule-set-per-year selection", () => {
  it("shows no rule-set-unavailable warning for a registered financial year (2025-26)", async () => {
    await renderPage("2025-26");
    expect(
      screen.queryByText(/No versioned tax rule set is published/),
    ).not.toBeInTheDocument();
  });

  it("shows the rule-set-unavailable warning for an unregistered financial year (2026-27)", async () => {
    await renderPage("2026-27");
    expect(
      screen.getByText(/No versioned tax rule set is published for FY 2026-27/),
    ).toBeInTheDocument();
  });
});

describe("TaxWorkspacePage — data scoped to the selected financial year", () => {
  it("queries every data source with the exact financial-year id from the route, never a different year", async () => {
    await renderPage("2024-25");

    expect(listTaxIncomeAdjustmentsMock).toHaveBeenCalledWith(
      expect.anything(),
      "2024-25",
    );
    expect(listTaxDeductionsMock).toHaveBeenCalledWith(
      expect.anything(),
      "2024-25",
    );
    expect(listTaxWithholdingsMock).toHaveBeenCalledWith(
      expect.anything(),
      "2024-25",
    );
    expect(listTaxPaymentsMock).toHaveBeenCalledWith(
      expect.anything(),
      "2024-25",
    );
    expect(listTaxReconciliationItemsMock).toHaveBeenCalledWith(
      expect.anything(),
      "2024-25",
    );
  });

  it("shows this year's income count only, not a count carried over from another year", async () => {
    listTaxIncomeAdjustmentsMock.mockImplementation(
      (_supabase, financialYearId) =>
        Promise.resolve(
          financialYearId === "2024-25"
            ? [
                {
                  id: "i1",
                  financialYearId: "2024-25",
                  category: "salary" as const,
                  grossAmount: new Decimal("1"),
                  tdsAmount: new Decimal("0"),
                  netAmount: new Decimal("1"),
                  currency: "INR",
                  isExemptCandidate: false,
                  sourceType: "manual" as const,
                  sourceLedgerTransactionId: null,
                  sourceInvestmentActivityId: null,
                  evidenceLabel: null,
                  notes: null,
                  status: "confirmed" as const,
                },
              ]
            : [],
        ),
    );

    await renderPage("2024-25");
    expect(screen.getByText("1")).toBeInTheDocument();
  });
});

describe("TaxWorkspacePage — empty state", () => {
  it("shows zero counts across every card when nothing has been recorded yet", async () => {
    await renderPage("2025-26");
    const zeroCounts = screen.getAllByText("0");
    expect(zeroCounts.length).toBeGreaterThan(0);
    expect(
      screen.getByText("No report generated yet for this financial year."),
    ).toBeInTheDocument();
  });

  it("prompts profile setup when no tax profile exists yet", async () => {
    await renderPage("2025-26");
    expect(
      screen.getByText(
        "Set up your tax profile to see which automated estimates apply to you.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Set up profile" }),
    ).toHaveAttribute("href", "/app/tax/profile");
  });
});
