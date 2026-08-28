import type { FinancialYear } from "@/lib/tax/financial-year";
import type { TaxReportSnapshot } from "@/lib/tax/mapping";

/**
 * Every reminder here is computed live from data already read elsewhere in
 * this module (income adjustments, withholdings, reconciliation items,
 * capital-gains disposals, report snapshots) — nothing is persisted, and
 * nothing is delivered by email/SMS/push. The advance-tax due dates below
 * are the Income Tax Act, 1961 s.211 statutory installment dates, which
 * have been stable for decades and are not a Budget-year-specific rule, so
 * hard-coding them here (rather than the versioned rule-set registry) is
 * the "authoritative, versioned, scope-appropriate" exception the phase
 * spec allows for.
 */

export const TAX_REMINDER_TYPES = [
  "financial_year_data_incomplete",
  "unclassified_income",
  "disposal_missing_acquisition_evidence",
  "tds_not_reconciled",
  "ais_difference_unresolved",
  "draft_report_stale",
  "advance_tax_date_approaching",
  "finalized_snapshot_superseded",
] as const;
export type TaxReminderType = (typeof TAX_REMINDER_TYPES)[number];

export type TaxReminder = {
  reminderType: TaxReminderType;
  title: string;
  dueDate: string | null;
};

/** [month (1-12), day] of each statutory advance-tax installment, in FY order. */
const ADVANCE_TAX_INSTALLMENTS: { month: number; day: number; cumulativePercent: number }[] = [
  { month: 6, day: 15, cumulativePercent: 15 },
  { month: 9, day: 15, cumulativePercent: 45 },
  { month: 12, day: 15, cumulativePercent: 75 },
  { month: 3, day: 15, cumulativePercent: 100 },
];

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** The next unpassed advance-tax installment date within `fy`, or null once the FY's final (15 March) installment has passed. Never assumes any tax is actually payable — purely a calendar fact. */
export function nextAdvanceTaxInstallment(
  today: string,
  fy: FinancialYear,
): { dueDate: string; cumulativePercent: number } | null {
  for (const installment of ADVANCE_TAX_INSTALLMENTS) {
    const year = installment.month >= 4 ? fy.startYear : fy.startYear + 1;
    const dueDate = `${year}-${pad2(installment.month)}-${pad2(installment.day)}`;
    if (dueDate >= today) {
      return { dueDate, cumulativePercent: installment.cumulativePercent };
    }
  }
  return null;
}

export type TaxReminderInput = {
  today: string;
  financialYear: FinancialYear;
  ruleSetAvailable: boolean;
  profileExists: boolean;
  unreviewedIncomeCount: number;
  disposalsNeedingReviewCount: number;
  unreviewedWithholdingsCount: number;
  reconciliationDifferencesCount: number;
  /** Every snapshot for this financial year, any status, newest-created first — see listTaxReportSnapshots. */
  snapshots: TaxReportSnapshot[];
  /** Most recent updated_at across income/deduction/withholding/reconciliation rows for this FY, if any exist. */
  latestSourceDataUpdatedAt: string | null;
};

/** Pure, side-effect-free derivation of the current financial year's tax reminders — never writes anything, safe to call on every dashboard render. */
export function computeTaxReminders(input: TaxReminderInput): TaxReminder[] {
  const reminders: TaxReminder[] = [];

  if (!input.ruleSetAvailable || !input.profileExists) {
    reminders.push({
      reminderType: "financial_year_data_incomplete",
      title: !input.profileExists
        ? "Set up your tax profile to enable estimates for this financial year."
        : `No versioned tax rule set is published for ${input.financialYear.label} yet.`,
      dueDate: null,
    });
  }

  if (input.unreviewedIncomeCount > 0) {
    reminders.push({
      reminderType: "unclassified_income",
      title: `${input.unreviewedIncomeCount} income item${input.unreviewedIncomeCount === 1 ? "" : "s"} awaiting confirmation.`,
      dueDate: null,
    });
  }

  if (input.disposalsNeedingReviewCount > 0) {
    reminders.push({
      reminderType: "disposal_missing_acquisition_evidence",
      title: `${input.disposalsNeedingReviewCount} disposal${input.disposalsNeedingReviewCount === 1 ? "" : "s"} or holding${input.disposalsNeedingReviewCount === 1 ? "" : "s"} need review — missing acquisition data, an unsupported adjustment, a mixed-currency holding, or no matching rate rule.`,
      dueDate: null,
    });
  }

  if (input.unreviewedWithholdingsCount > 0) {
    reminders.push({
      reminderType: "tds_not_reconciled",
      title: `${input.unreviewedWithholdingsCount} TDS/TCS record${input.unreviewedWithholdingsCount === 1 ? "" : "s"} not yet reconciled.`,
      dueDate: null,
    });
  }

  if (input.reconciliationDifferencesCount > 0) {
    reminders.push({
      reminderType: "ais_difference_unresolved",
      title: `${input.reconciliationDifferencesCount} AIS/26AS reconciliation difference${input.reconciliationDifferencesCount === 1 ? "" : "s"} unresolved.`,
      dueDate: null,
    });
  }

  const latestDraft = input.snapshots.find((s) =>
    s.status === "draft" || s.status === "needs_review" || s.status === "ready",
  );
  if (
    latestDraft &&
    input.latestSourceDataUpdatedAt &&
    input.latestSourceDataUpdatedAt > latestDraft.generatedAt
  ) {
    reminders.push({
      reminderType: "draft_report_stale",
      title: "Your draft report was generated before some recent tax-data changes — regenerate it to include them.",
      dueDate: null,
    });
  }

  if (input.snapshots.some((s) => s.status === "superseded")) {
    reminders.push({
      reminderType: "finalized_snapshot_superseded",
      title: "A previously finalized report for this financial year has been superseded by a newer one.",
      dueDate: null,
    });
  }

  const nextInstallment = nextAdvanceTaxInstallment(input.today, input.financialYear);
  if (nextInstallment) {
    reminders.push({
      reminderType: "advance_tax_date_approaching",
      title: `Advance-tax installment (${nextInstallment.cumulativePercent}% cumulative) due ${nextInstallment.dueDate}, if any tax is payable.`,
      dueDate: nextInstallment.dueDate,
    });
  }

  return reminders;
}
