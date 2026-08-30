import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { getAuthenticatedUser } from "@/lib/auth/session";
import { Decimal } from "@/lib/money/decimal";
import type { getCapitalGainsReportForYear } from "@/lib/tax/capital-gains-data";
import type {
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

const listTaxIncomeAdjustmentsMock = vi.fn<typeof listTaxIncomeAdjustments>();
const listTaxDeductionsMock = vi.fn<typeof listTaxDeductions>();
const listTaxWithholdingsMock = vi.fn<typeof listTaxWithholdings>();
const listTaxPaymentsMock = vi.fn<typeof listTaxPayments>();
const listTaxReconciliationItemsMock =
  vi.fn<typeof listTaxReconciliationItems>();
vi.mock("@/lib/tax/queries", () => ({
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
}));

const getCapitalGainsReportForYearMock =
  vi.fn<typeof getCapitalGainsReportForYear>();
vi.mock("@/lib/tax/capital-gains-data", () => ({
  getCapitalGainsReportForYear: (
    ...args: Parameters<typeof getCapitalGainsReportForYear>
  ) => getCapitalGainsReportForYearMock(...args),
}));

beforeEach(() => {
  vi.clearAllMocks();
  getAuthenticatedUserMock.mockResolvedValue({
    id: "user-1",
    email: "asha@example.com",
  });
  listTaxIncomeAdjustmentsMock.mockResolvedValue([]);
  listTaxDeductionsMock.mockResolvedValue([]);
  listTaxWithholdingsMock.mockResolvedValue([]);
  listTaxPaymentsMock.mockResolvedValue([]);
  listTaxReconciliationItemsMock.mockResolvedValue([]);
});

async function callRoute(financialYear: string, reportType: string) {
  const { GET } =
    await import("@/app/app/tax/[financialYear]/export/[reportType]/route");
  return GET(new NextRequest("http://localhost/x"), {
    params: Promise.resolve({ financialYear, reportType }),
  });
}

describe("GET /app/tax/[financialYear]/export/[reportType]", () => {
  it("returns 401 when there is no authenticated user", async () => {
    getAuthenticatedUserMock.mockResolvedValue(null);
    const response = await callRoute("2025-26", "income");
    expect(response.status).toBe(401);
  });

  it("returns 404 for an invalid financial-year id", async () => {
    const response = await callRoute("not-a-year", "income");
    expect(response.status).toBe(404);
  });

  it("returns 404 for an unsupported report type", async () => {
    const response = await callRoute("2025-26", "not-a-report");
    expect(response.status).toBe(404);
  });

  it("serves a CSV with the correct content type and a filename carrying the selected FY", async () => {
    const response = await callRoute("2025-26", "income");
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/csv");
    expect(response.headers.get("Content-Disposition")).toContain(
      "penra-tax-2025-26-income.csv",
    );
  });

  it("includes the financial year, assessment year, rule-set version, and disclaimer in the income export", async () => {
    const response = await callRoute("2025-26", "income");
    const body = await response.text();
    expect(body).toContain("2025-26");
    expect(body).toContain("2026-27");
    expect(body).toContain("in-individual-2025-26.v1");
    expect(body).toContain("not an income-tax return");
  });

  it("marks completeness as unavailable and adds an assumption when no rule set is published for the year", async () => {
    const response = await callRoute("2026-27", "income");
    const body = await response.text();
    expect(body).toContain("unavailable");
    expect(body).toContain("No versioned tax rule set is published");
  });

  it("filters the interest export to only interest categories, excluding salary and dividend", async () => {
    listTaxIncomeAdjustmentsMock.mockResolvedValue([
      {
        id: "i1",
        financialYearId: "2025-26",
        category: "fd_interest",
        grossAmount: new Decimal(1000),
        tdsAmount: new Decimal(100),
        netAmount: new Decimal(900),
        currency: "INR",
        isExemptCandidate: false,
        sourceType: "manual",
        sourceLedgerTransactionId: null,
        sourceInvestmentActivityId: null,
        evidenceLabel: "HDFC FD",
        notes: null,
        status: "confirmed",
      },
      {
        id: "i2",
        financialYearId: "2025-26",
        category: "salary",
        grossAmount: new Decimal(600000),
        tdsAmount: new Decimal(20000),
        netAmount: new Decimal(580000),
        currency: "INR",
        isExemptCandidate: false,
        sourceType: "manual",
        sourceLedgerTransactionId: null,
        sourceInvestmentActivityId: null,
        evidenceLabel: null,
        notes: null,
        status: "confirmed",
      },
      {
        id: "i3",
        financialYearId: "2025-26",
        category: "dividend",
        grossAmount: new Decimal(5000),
        tdsAmount: new Decimal(500),
        netAmount: new Decimal(4500),
        currency: "INR",
        isExemptCandidate: false,
        sourceType: "manual",
        sourceLedgerTransactionId: null,
        sourceInvestmentActivityId: null,
        evidenceLabel: null,
        notes: null,
        status: "confirmed",
      },
    ]);
    const response = await callRoute("2025-26", "interest");
    const body = await response.text();
    expect(body).toContain("HDFC FD");
    expect(body).not.toContain("580000");
    expect(body).not.toContain("4500");
  });

  it("filters the dividend export to only dividend-category income", async () => {
    listTaxIncomeAdjustmentsMock.mockResolvedValue([
      {
        id: "i1",
        financialYearId: "2025-26",
        category: "dividend",
        grossAmount: new Decimal(5000),
        tdsAmount: new Decimal(500),
        netAmount: new Decimal(4500),
        currency: "INR",
        isExemptCandidate: false,
        sourceType: "manual",
        sourceLedgerTransactionId: null,
        sourceInvestmentActivityId: null,
        evidenceLabel: "Example Corp",
        notes: null,
        status: "confirmed",
      },
      {
        id: "i2",
        financialYearId: "2025-26",
        category: "savings_interest",
        grossAmount: new Decimal(200),
        tdsAmount: new Decimal(0),
        netAmount: new Decimal(200),
        currency: "INR",
        isExemptCandidate: false,
        sourceType: "manual",
        sourceLedgerTransactionId: null,
        sourceInvestmentActivityId: null,
        evidenceLabel: null,
        notes: null,
        status: "confirmed",
      },
    ]);
    const response = await callRoute("2025-26", "dividends");
    const body = await response.text();
    expect(body).toContain("Example Corp");
    expect(body).not.toContain("savings_interest");
  });

  it("returns an empty, header-only capital-gains export when no rule set is available for the year", async () => {
    const response = await callRoute("2026-27", "capital-gains");
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain("Instrument,ISIN/Symbol");
    expect(getCapitalGainsReportForYearMock).not.toHaveBeenCalled();
  });
});
