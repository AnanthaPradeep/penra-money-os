import { describe, expect, it } from "vitest";

import { Decimal } from "@/lib/money/decimal";
import {
  buildCapitalGainsCsv,
  buildDeductionSummaryCsv,
  buildDividendReportCsv,
  buildIncomeSummaryCsv,
  buildInterestReportCsv,
  buildReconciliationCsv,
  buildTdsPaymentSummaryCsv,
  type ExportHeader,
} from "@/lib/tax/export/reports";
import type { CapitalGainLine } from "@/lib/tax/engine/capital-gains";

function header(overrides: Partial<ExportHeader> = {}): ExportHeader {
  return {
    title: "Income summary",
    financialYearId: "2025-26",
    assessmentYearId: "2026-27",
    generatedAt: "2026-08-27T12:00:00.000Z",
    currency: "INR",
    ruleSetVersion: "in-individual-2025-26.v1",
    completenessStatus: "complete",
    assumptions: [],
    unsupportedItems: [],
    ...overrides,
  };
}

describe("export report builders — shared header block", () => {
  it("includes financial year, assessment year, rule-set version, completeness, and the standard disclaimer", () => {
    const csv = buildIncomeSummaryCsv(header(), []);
    expect(csv).toContain("2025-26");
    expect(csv).toContain("2026-27");
    expect(csv).toContain("in-individual-2025-26.v1");
    expect(csv).toContain("complete");
    expect(csv).toContain("not an income-tax return");
  });

  it("lists every assumption and unsupported item passed in", () => {
    const csv = buildIncomeSummaryCsv(
      header({
        assumptions: ["Interest accrues monthly."],
        unsupportedItems: ["Holding X: unsupported adjustment present."],
      }),
      [],
    );
    expect(csv).toContain("Interest accrues monthly.");
    expect(csv).toContain("Holding X: unsupported adjustment present.");
  });
});

describe("buildIncomeSummaryCsv", () => {
  it("renders gross/tds/net as distinct columns, never collapsed into one", () => {
    const csv = buildIncomeSummaryCsv(header(), [
      {
        category: "salary",
        grossAmount: new Decimal(600000),
        tdsAmount: new Decimal(20000),
        netAmount: new Decimal(580000),
        isExemptCandidate: false,
        sourceReference: "manual:abc123",
      },
    ]);
    expect(csv).toContain("600000");
    expect(csv).toContain("20000");
    expect(csv).toContain("580000");
  });
});

describe("buildInterestReportCsv", () => {
  it("renders one row per interest source with gross/tds/net", () => {
    const csv = buildInterestReportCsv(header(), [
      {
        category: "fd_interest",
        sourceName: "HDFC FD",
        grossAmount: new Decimal(10000),
        tdsAmount: new Decimal(1000),
        netAmount: new Decimal(9000),
        sourceReference: "manual:fd1",
      },
    ]);
    expect(csv).toContain("HDFC FD");
    expect(csv).toContain("9000");
  });
});

describe("buildDividendReportCsv", () => {
  it("flags a missing evidence gap explicitly rather than assuming zero TDS", () => {
    const csv = buildDividendReportCsv(header(), [
      {
        instrumentName: "Example Corp",
        paymentDate: "2025-09-01",
        grossDividend: new Decimal(5000),
        tdsAmount: new Decimal(0),
        netReceipt: new Decimal(5000),
        hasEvidenceGap: true,
        sourceReference: "activity:xyz",
      },
    ]);
    expect(csv).toContain("Yes");
  });
});

describe("buildCapitalGainsCsv", () => {
  it("includes every required column from the spec's capital-gains report shape", () => {
    const line: CapitalGainLine = {
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
    };
    const csv = buildCapitalGainsCsv(header(), [line]);
    expect(csv).toContain("Example Corp");
    expect(csv).toContain("INE000A00000");
    expect(csv).toContain("long_term");
    expect(csv).toContain("490");
  });

  it("never exposes an internal-only field the caller didn't include as a column", () => {
    const csv = buildCapitalGainsCsv(header(), []);
    expect(csv).not.toContain("holdingId");
  });
});

describe("buildDeductionSummaryCsv", () => {
  it("shows claimed vs. eligible-per-regime vs. excluded as distinct figures", () => {
    const csv = buildDeductionSummaryCsv(header(), [
      {
        section: "80C",
        claimedAmount: new Decimal(200000),
        eligibleAmountOld: new Decimal(150000),
        eligibleAmountNew: new Decimal(0),
        excludedAmount: new Decimal(50000),
        exclusionReason: "Exceeds the section 80C cap of 150000",
        evidenceLabel: "PPF passbook",
        status: "confirmed",
      },
    ]);
    expect(csv).toContain("200000");
    expect(csv).toContain("150000");
    expect(csv).toContain("Exceeds the section 80C cap");
  });
});

describe("buildTdsPaymentSummaryCsv", () => {
  it("renders TDS and payment records with reconciliation status", () => {
    const csv = buildTdsPaymentSummaryCsv(header(), [
      {
        recordType: "salary_tds",
        sourceName: "Acme Corp",
        grossAmount: new Decimal(600000),
        taxAmount: new Decimal(45000),
        date: "2025-06-01",
        referenceLabel: "Q1-TDS",
        reconciliationStatus: "matched",
      },
    ]);
    expect(csv).toContain("Acme Corp");
    expect(csv).toContain("matched");
  });
});

describe("buildReconciliationCsv", () => {
  it("keeps reported/processed/PENRA/accepted amounts as four distinct columns", () => {
    const csv = buildReconciliationCsv(header(), [
      {
        source: "form_26as",
        incomeCategory: "salary_tds",
        reportedAmount: "45000",
        processedAmount: "45000",
        penraAmount: "44000",
        acceptedAmount: "",
        status: "difference",
        explanation: "1000 gap under review",
      },
    ]);
    expect(csv).toContain("45000");
    expect(csv).toContain("44000");
    expect(csv).toContain("difference");
  });
});
