import { describe, expect, it } from "vitest";

import { financialYearFromStartYear } from "@/lib/tax/financial-year";
import type { TaxReportSnapshot } from "@/lib/tax/mapping";
import {
  computeTaxReminders,
  nextAdvanceTaxInstallment,
  type TaxReminderInput,
} from "@/lib/tax/reminders";

const FY = financialYearFromStartYear(2025);

function snapshot(overrides: Partial<TaxReportSnapshot>): TaxReportSnapshot {
  return {
    id: "snap-1",
    financialYearId: FY.id,
    assessmentYearId: FY.assessmentYearId,
    ruleSetVersion: "in-individual-2025-26.v1",
    status: "draft",
    completenessStatus: "partial",
    snapshotData: null,
    warnings: [],
    supersedesSnapshotId: null,
    supersededBy: null,
    generatedAt: "2025-06-01T00:00:00Z",
    finalizedAt: null,
    ...overrides,
  };
}

function baseInput(overrides: Partial<TaxReminderInput> = {}): TaxReminderInput {
  return {
    today: "2025-06-01",
    financialYear: FY,
    ruleSetAvailable: true,
    profileExists: true,
    unreviewedIncomeCount: 0,
    disposalsNeedingReviewCount: 0,
    unreviewedWithholdingsCount: 0,
    reconciliationDifferencesCount: 0,
    snapshots: [],
    latestSourceDataUpdatedAt: null,
    ...overrides,
  };
}

describe("nextAdvanceTaxInstallment", () => {
  it("returns the first unpassed installment", () => {
    const result = nextAdvanceTaxInstallment("2025-06-01", FY);
    expect(result).toEqual({ dueDate: "2025-06-15", cumulativePercent: 15 });
  });

  it("rolls over into the following calendar year for the March installment", () => {
    const result = nextAdvanceTaxInstallment("2025-12-16", FY);
    expect(result).toEqual({ dueDate: "2026-03-15", cumulativePercent: 100 });
  });

  it("treats the due date itself as not yet passed", () => {
    const result = nextAdvanceTaxInstallment("2025-06-15", FY);
    expect(result?.dueDate).toBe("2025-06-15");
  });

  it("returns null once the final installment has passed", () => {
    const result = nextAdvanceTaxInstallment("2026-03-16", FY);
    expect(result).toBeNull();
  });
});

describe("computeTaxReminders", () => {
  it("flags an incomplete financial year when the rule set is unavailable", () => {
    const reminders = computeTaxReminders(baseInput({ ruleSetAvailable: false }));
    expect(reminders.map((r) => r.reminderType)).toContain(
      "financial_year_data_incomplete",
    );
  });

  it("flags an incomplete financial year when no profile exists, with a distinct message", () => {
    const reminders = computeTaxReminders(baseInput({ profileExists: false }));
    const reminder = reminders.find(
      (r) => r.reminderType === "financial_year_data_incomplete",
    );
    expect(reminder?.title).toMatch(/tax profile/i);
  });

  it("does not flag an incomplete financial year when profile and rule set are both present", () => {
    const reminders = computeTaxReminders(baseInput());
    expect(reminders.map((r) => r.reminderType)).not.toContain(
      "financial_year_data_incomplete",
    );
  });

  it("flags unreviewed income items with correct singular/plural wording", () => {
    const singular = computeTaxReminders(baseInput({ unreviewedIncomeCount: 1 }));
    expect(
      singular.find((r) => r.reminderType === "unclassified_income")?.title,
    ).toContain("1 income item ");

    const plural = computeTaxReminders(baseInput({ unreviewedIncomeCount: 3 }));
    expect(
      plural.find((r) => r.reminderType === "unclassified_income")?.title,
    ).toContain("3 income items");
  });

  it("flags disposals needing review", () => {
    const reminders = computeTaxReminders(
      baseInput({ disposalsNeedingReviewCount: 2 }),
    );
    expect(reminders.map((r) => r.reminderType)).toContain(
      "disposal_missing_acquisition_evidence",
    );
  });

  it("flags unreconciled TDS/TCS records", () => {
    const reminders = computeTaxReminders(
      baseInput({ unreviewedWithholdingsCount: 1 }),
    );
    expect(reminders.map((r) => r.reminderType)).toContain("tds_not_reconciled");
  });

  it("flags unresolved AIS/26AS differences", () => {
    const reminders = computeTaxReminders(
      baseInput({ reconciliationDifferencesCount: 1 }),
    );
    expect(reminders.map((r) => r.reminderType)).toContain(
      "ais_difference_unresolved",
    );
  });

  it("flags a stale draft report when source data changed after it was generated", () => {
    const reminders = computeTaxReminders(
      baseInput({
        snapshots: [snapshot({ status: "draft", generatedAt: "2025-06-01T00:00:00Z" })],
        latestSourceDataUpdatedAt: "2025-06-02T00:00:00Z",
      }),
    );
    expect(reminders.map((r) => r.reminderType)).toContain("draft_report_stale");
  });

  it("does not flag staleness when source data predates the draft", () => {
    const reminders = computeTaxReminders(
      baseInput({
        snapshots: [snapshot({ status: "draft", generatedAt: "2025-06-02T00:00:00Z" })],
        latestSourceDataUpdatedAt: "2025-06-01T00:00:00Z",
      }),
    );
    expect(reminders.map((r) => r.reminderType)).not.toContain("draft_report_stale");
  });

  it("flags a superseded finalized snapshot", () => {
    const reminders = computeTaxReminders(
      baseInput({ snapshots: [snapshot({ status: "superseded" })] }),
    );
    expect(reminders.map((r) => r.reminderType)).toContain(
      "finalized_snapshot_superseded",
    );
  });

  it("always includes the advance-tax reminder mid-year with the correct due date", () => {
    const reminders = computeTaxReminders(baseInput({ today: "2025-06-01" }));
    const reminder = reminders.find(
      (r) => r.reminderType === "advance_tax_date_approaching",
    );
    expect(reminder?.dueDate).toBe("2025-06-15");
  });

  it("omits the advance-tax reminder once the FY's final installment has passed", () => {
    const reminders = computeTaxReminders(baseInput({ today: "2026-03-16" }));
    expect(reminders.map((r) => r.reminderType)).not.toContain(
      "advance_tax_date_approaching",
    );
  });
});
