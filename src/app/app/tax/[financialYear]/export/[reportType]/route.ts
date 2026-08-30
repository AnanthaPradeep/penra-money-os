import { NextResponse, type NextRequest } from "next/server";

import { getAuthenticatedUser } from "@/lib/auth/session";
import { Decimal } from "@/lib/money/decimal";
import { getCapitalGainsReportForYear } from "@/lib/tax/capital-gains-data";
import {
  isValidFinancialYearId,
  parseFinancialYearId,
} from "@/lib/tax/financial-year";
import {
  INCOME_CATEGORY_LABELS,
  WITHHOLDING_TYPE_LABELS,
  TAX_PAYMENT_TYPE_LABELS,
} from "@/lib/tax/mapping";
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
import {
  listTaxDeductions,
  listTaxIncomeAdjustments,
  listTaxPayments,
  listTaxReconciliationItems,
  listTaxWithholdings,
} from "@/lib/tax/queries";
import { getTaxRuleSet } from "@/lib/tax/rules/registry";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const REPORT_TYPES = [
  "income",
  "interest",
  "dividends",
  "capital-gains",
  "deductions",
  "payments",
  "reconciliation",
] as const;
type ReportType = (typeof REPORT_TYPES)[number];

function isReportType(value: string): value is ReportType {
  return (REPORT_TYPES as readonly string[]).includes(value);
}

type RouteParams = { financialYear: string; reportType: string };

export async function GET(
  _request: NextRequest,
  context: { params: Promise<RouteParams> },
) {
  const { financialYear, reportType } = await context.params;

  if (!isValidFinancialYearId(financialYear) || !isReportType(reportType)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const user = await getAuthenticatedUser();
  if (!user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const fy = parseFinancialYearId(financialYear);
  const ruleSetLookup = getTaxRuleSet(financialYear);
  const supabase = await createSupabaseServerClient();

  const header: ExportHeader = {
    title: `${reportType} report`,
    financialYearId: fy.id,
    assessmentYearId: fy.assessmentYearId,
    generatedAt: new Date().toISOString(),
    currency: "INR",
    ruleSetVersion: ruleSetLookup.available
      ? ruleSetLookup.ruleSet.ruleSetVersion
      : "unavailable",
    completenessStatus: ruleSetLookup.available ? "complete" : "unavailable",
    assumptions: ruleSetLookup.available
      ? []
      : [`No versioned tax rule set is published for ${fy.label} yet.`],
    unsupportedItems: [],
  };

  let csv: string;

  switch (reportType) {
    case "income": {
      const items = await listTaxIncomeAdjustments(supabase, financialYear);
      csv = buildIncomeSummaryCsv(
        header,
        items.map((i) => ({
          category: INCOME_CATEGORY_LABELS[i.category],
          grossAmount: i.grossAmount,
          tdsAmount: i.tdsAmount,
          netAmount: i.netAmount,
          isExemptCandidate: i.isExemptCandidate,
          sourceReference: `${i.sourceType}:${i.id}`,
        })),
      );
      break;
    }
    case "interest": {
      const items = await listTaxIncomeAdjustments(supabase, financialYear);
      const interest = items.filter((i) =>
        [
          "savings_interest",
          "fd_interest",
          "rd_interest",
          "ppf_interest",
          "refund_interest",
          "other_taxable_interest",
        ].includes(i.category),
      );
      csv = buildInterestReportCsv(
        header,
        interest.map((i) => ({
          category: INCOME_CATEGORY_LABELS[i.category],
          sourceName: i.evidenceLabel ?? "—",
          grossAmount: i.grossAmount,
          tdsAmount: i.tdsAmount,
          netAmount: i.netAmount,
          sourceReference: `${i.sourceType}:${i.id}`,
        })),
      );
      break;
    }
    case "dividends": {
      const items = await listTaxIncomeAdjustments(supabase, financialYear);
      const dividends = items.filter((i) => i.category === "dividend");
      csv = buildDividendReportCsv(
        header,
        dividends.map((i) => ({
          instrumentName: i.evidenceLabel ?? "Dividend",
          paymentDate: "",
          grossDividend: i.grossAmount,
          tdsAmount: i.tdsAmount,
          netReceipt: i.netAmount,
          hasEvidenceGap: i.tdsAmount.isZero() && i.grossAmount.gt(0),
          sourceReference: `${i.sourceType}:${i.id}`,
        })),
      );
      break;
    }
    case "capital-gains": {
      if (!ruleSetLookup.available) {
        csv = buildCapitalGainsCsv(header, []);
        break;
      }
      const { report } = await getCapitalGainsReportForYear(
        supabase,
        ruleSetLookup.ruleSet,
        fy,
      );
      csv = buildCapitalGainsCsv(header, report.lines);
      break;
    }
    case "deductions": {
      const deductions = await listTaxDeductions(supabase, financialYear);
      csv = buildDeductionSummaryCsv(
        header,
        deductions.map((d) => {
          const rule = ruleSetLookup.available
            ? ruleSetLookup.ruleSet.deductionCatalog.find(
                (c) => c.section === d.section,
              )
            : undefined;
          const oldCap = rule?.regimes.includes("old")
            ? rule.maxAmount
              ? Decimal.min(d.claimedAmount, rule.maxAmount)
              : d.claimedAmount
            : new Decimal(0);
          const newCap = rule?.regimes.includes("new")
            ? rule.maxAmount
              ? Decimal.min(d.claimedAmount, rule.maxAmount)
              : d.claimedAmount
            : new Decimal(0);
          return {
            section: d.section,
            claimedAmount: d.claimedAmount,
            eligibleAmountOld: oldCap,
            eligibleAmountNew: newCap,
            excludedAmount: d.claimedAmount.minus(Decimal.max(oldCap, newCap)),
            exclusionReason: rule
              ? ""
              : "No matching rule for this financial year",
            evidenceLabel: d.evidenceLabel ?? "",
            status: d.status,
          };
        }),
      );
      break;
    }
    case "payments": {
      const [withholdings, payments] = await Promise.all([
        listTaxWithholdings(supabase, financialYear),
        listTaxPayments(supabase, financialYear),
      ]);
      csv = buildTdsPaymentSummaryCsv(header, [
        ...withholdings.map((w) => ({
          recordType: WITHHOLDING_TYPE_LABELS[w.withholdingType],
          sourceName: w.deductorName,
          grossAmount: w.grossAmount,
          taxAmount: w.taxWithheld,
          date: w.withheldOn,
          referenceLabel: w.referenceLabel ?? "",
          reconciliationStatus: w.reconciliationStatus,
        })),
        ...payments.map((p) => ({
          recordType: TAX_PAYMENT_TYPE_LABELS[p.paymentType],
          sourceName: "",
          grossAmount: p.amount,
          taxAmount: p.amount,
          date: p.paidOn,
          referenceLabel: p.challanReference ?? "",
          reconciliationStatus: "",
        })),
      ]);
      break;
    }
    case "reconciliation": {
      const items = await listTaxReconciliationItems(supabase, financialYear);
      csv = buildReconciliationCsv(
        header,
        items.map((r) => ({
          source: r.source,
          incomeCategory: r.incomeCategory,
          reportedAmount: r.reportedAmount?.toString() ?? "",
          processedAmount: r.processedAmount?.toString() ?? "",
          penraAmount: r.penraAmount?.toString() ?? "",
          acceptedAmount: r.acceptedAmount?.toString() ?? "",
          status: r.status,
          explanation: r.explanation ?? "",
        })),
      );
      break;
    }
  }

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="penra-tax-${financialYear}-${reportType}.csv"`,
    },
  });
}
