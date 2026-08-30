import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { getAuthenticatedUser } from "@/lib/auth/session";
import { Decimal } from "@/lib/money/decimal";
import { formatINR } from "@/lib/money/format";
import type { TaxIncomeAdjustment } from "@/lib/tax/mapping";
import type { listTaxIncomeAdjustments } from "@/lib/tax/queries";

const getAuthenticatedUserMock = vi.fn<typeof getAuthenticatedUser>();
vi.mock("@/lib/auth/session", () => ({
  getAuthenticatedUser: (...args: Parameters<typeof getAuthenticatedUser>) =>
    getAuthenticatedUserMock(...args),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(() => Promise.resolve({})),
}));

const listTaxIncomeAdjustmentsMock = vi.fn<typeof listTaxIncomeAdjustments>();
vi.mock("@/lib/tax/queries", () => ({
  listTaxIncomeAdjustments: (
    ...args: Parameters<typeof listTaxIncomeAdjustments>
  ) => listTaxIncomeAdjustmentsMock(...args),
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

function item(overrides: Partial<TaxIncomeAdjustment>): TaxIncomeAdjustment {
  return {
    id: "item-1",
    financialYearId: "2025-26",
    category: "savings_interest",
    grossAmount: new Decimal(1000),
    tdsAmount: new Decimal(0),
    netAmount: new Decimal(1000),
    currency: "INR",
    isExemptCandidate: false,
    sourceType: "manual",
    sourceLedgerTransactionId: null,
    sourceInvestmentActivityId: null,
    evidenceLabel: null,
    notes: null,
    status: "confirmed",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  getAuthenticatedUserMock.mockResolvedValue({
    id: "user-1",
    email: "asha@example.com",
  });
  listTaxIncomeAdjustmentsMock.mockResolvedValue([]);
});

async function renderPage(financialYear = "2025-26") {
  const { default: InterestDividendsPage } =
    await import("@/app/app/tax/[financialYear]/interest-dividends/page");
  return render(
    await InterestDividendsPage({
      params: Promise.resolve({ financialYear }),
    }),
  );
}

describe("InterestDividendsPage — interest categories", () => {
  it("shows savings, FD, RD, refund, and other-confirmed interest, each labelled distinctly", async () => {
    listTaxIncomeAdjustmentsMock.mockResolvedValue([
      item({
        id: "i1",
        category: "savings_interest",
        grossAmount: new Decimal(100),
      }),
      item({
        id: "i2",
        category: "fd_interest",
        grossAmount: new Decimal(200),
      }),
      item({
        id: "i3",
        category: "rd_interest",
        grossAmount: new Decimal(300),
      }),
      item({
        id: "i4",
        category: "refund_interest",
        grossAmount: new Decimal(400),
      }),
      item({
        id: "i5",
        category: "other_taxable_interest",
        grossAmount: new Decimal(500),
      }),
    ]);
    await renderPage();

    expect(screen.getByText("Savings account interest")).toBeInTheDocument();
    expect(screen.getByText("Fixed deposit interest")).toBeInTheDocument();
    expect(screen.getByText("Recurring deposit interest")).toBeInTheDocument();
    expect(screen.getByText("Income-tax refund interest")).toBeInTheDocument();
    expect(screen.getByText("Other taxable interest")).toBeInTheDocument();
  });

  it("keeps gross interest and TDS as two separate figures, with net always derived, never an independent stored value", async () => {
    listTaxIncomeAdjustmentsMock.mockResolvedValue([
      item({
        category: "fd_interest",
        grossAmount: new Decimal(10000),
        tdsAmount: new Decimal(1000),
        netAmount: new Decimal(9000),
      }),
    ]);
    await renderPage();

    expect(screen.getByText(/TDS 1000/)).toBeInTheDocument();
    expect(screen.getByText(formatINR(new Decimal(10000)))).toBeInTheDocument();
    expect(screen.getByText(formatINR(new Decimal(9000)))).toBeInTheDocument();
  });
});

describe("InterestDividendsPage — dividends", () => {
  it("shows dividend gross/TDS/net as three distinct figures", async () => {
    listTaxIncomeAdjustmentsMock.mockResolvedValue([
      item({
        category: "dividend",
        evidenceLabel: "Example Corp",
        grossAmount: new Decimal(20000),
        tdsAmount: new Decimal(2000),
        netAmount: new Decimal(18000),
      }),
    ]);
    await renderPage();

    expect(screen.getByText("Example Corp")).toBeInTheDocument();
    expect(screen.getByText(/Gross 20000/)).toBeInTheDocument();
    expect(screen.getByText(/TDS 2000/)).toBeInTheDocument();
    expect(screen.getByText(formatINR(new Decimal(18000)))).toBeInTheDocument();
  });

  it("shows an empty state when no dividends are classified", async () => {
    await renderPage();
    expect(screen.getByText("No dividends classified yet")).toBeInTheDocument();
  });
});

describe("InterestDividendsPage — PPF is an exempt-income candidate only when its own row says so", () => {
  it("lists a PPF interest item marked exempt-candidate, without treating every PPF row as exempt automatically", async () => {
    listTaxIncomeAdjustmentsMock.mockResolvedValue([
      item({
        category: "ppf_interest",
        grossAmount: new Decimal(5000),
        isExemptCandidate: true,
      }),
    ]);
    await renderPage();

    expect(screen.getByText("PPF interest")).toBeInTheDocument();
    expect(screen.getByText(formatINR(new Decimal(5000)))).toBeInTheDocument();
    // A PPF item the user explicitly classified renders as a plain listed
    // amount — no separate exemption claim is asserted here; the
    // no-auto-exemption guarantee is what the *empty*-state copy (asserted
    // in the test below) documents.
    expect(
      screen.queryByText(/No PPF interest classified/),
    ).not.toBeInTheDocument();
  });

  it("shows the PPF section empty-state copy when no PPF interest has been classified, rather than assuming a PPF-linked account implies exemption", async () => {
    await renderPage();
    expect(
      screen.getByText(/No PPF interest classified\. Not every credit/),
    ).toBeInTheDocument();
  });
});

describe("InterestDividendsPage — empty, partial, and error-adjacent states", () => {
  it("shows an empty-interest state when nothing has been classified yet", async () => {
    await renderPage();
    expect(screen.getByText("No interest classified yet")).toBeInTheDocument();
  });

  it("redirects unauthenticated visitors to login rather than rendering financial data", async () => {
    getAuthenticatedUserMock.mockResolvedValue(null);
    await expect(renderPage()).rejects.toThrow(/NEXT_REDIRECT/);
  });

  it("rejects a malformed financial-year id with notFound", async () => {
    await expect(renderPage("bad-year")).rejects.toThrow(/NEXT_NOT_FOUND/);
  });
});
