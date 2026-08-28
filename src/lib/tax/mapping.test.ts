import { describe, expect, it } from "vitest";

import {
  isProfileWithinSupportedScope,
  mapTaxIncomeAdjustmentRow,
  mapTaxProfileRow,
  type TaxProfile,
} from "@/lib/tax/mapping";
import type { TaxIncomeAdjustmentRow, TaxProfileRow } from "@/lib/tax/types";

function incomeRow(
  overrides: Partial<TaxIncomeAdjustmentRow> = {},
): TaxIncomeAdjustmentRow {
  return {
    id: "row-1",
    user_id: "user-1",
    financial_year_id: "2025-26",
    category: "savings_interest",
    gross_amount: 1000,
    tds_amount: 0,
    currency: "INR",
    is_exempt_candidate: false,
    source_type: "manual",
    source_ledger_transaction_id: null,
    source_investment_activity_id: null,
    evidence_label: null,
    notes: null,
    status: "draft",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function profileRow(overrides: Partial<TaxProfileRow> = {}): TaxProfileRow {
  return {
    id: "profile-1",
    user_id: "user-1",
    taxpayer_type: "individual",
    residential_status: "resident",
    has_business_or_professional_income: false,
    has_salary_or_pension_income: true,
    default_regime_preference: null,
    age_band: null,
    masked_pan_label: null,
    notes: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("mapTaxIncomeAdjustmentRow — interest and dividend gross/TDS/net", () => {
  it("derives net as gross minus TDS, never reading a stored net figure", () => {
    const row = incomeRow({
      category: "fd_interest",
      gross_amount: 10000,
      tds_amount: 1000,
    });

    const mapped = mapTaxIncomeAdjustmentRow(row);

    expect(mapped.grossAmount.toString()).toBe("10000");
    expect(mapped.tdsAmount.toString()).toBe("1000");
    expect(mapped.netAmount.toString()).toBe("9000");
  });

  it("keeps net equal to gross when no TDS was withheld", () => {
    const row = incomeRow({
      category: "savings_interest",
      gross_amount: 500,
      tds_amount: 0,
    });

    const mapped = mapTaxIncomeAdjustmentRow(row);

    expect(mapped.netAmount.toString()).toBe(mapped.grossAmount.toString());
  });

  it("keeps gross, TDS, and net as three distinct values for a dividend row", () => {
    const row = incomeRow({
      category: "dividend",
      gross_amount: 20000,
      tds_amount: 2000,
    });

    const mapped = mapTaxIncomeAdjustmentRow(row);

    expect(mapped.grossAmount.toString()).toBe("20000");
    expect(mapped.tdsAmount.toString()).toBe("2000");
    expect(mapped.netAmount.toString()).toBe("18000");
    // Never conflate net (what actually lands in the bank) with gross (what's taxable).
    expect(mapped.netAmount.equals(mapped.grossAmount)).toBe(false);
  });

  it("recognises rd_interest, refund_interest, and other_taxable_interest as distinct interest categories", () => {
    for (const category of [
      "rd_interest",
      "refund_interest",
      "other_taxable_interest",
    ] as const) {
      const mapped = mapTaxIncomeAdjustmentRow(incomeRow({ category }));
      expect(mapped.category).toBe(category);
    }
  });
});

describe("mapTaxIncomeAdjustmentRow — PPF interest is never auto-assumed exempt", () => {
  it("maps isExemptCandidate straight from the row's own column for a ppf_interest row, not from the category", () => {
    const notExempt = mapTaxIncomeAdjustmentRow(
      incomeRow({ category: "ppf_interest", is_exempt_candidate: false }),
    );
    expect(notExempt.isExemptCandidate).toBe(false);

    const markedExempt = mapTaxIncomeAdjustmentRow(
      incomeRow({ category: "ppf_interest", is_exempt_candidate: true }),
    );
    expect(markedExempt.isExemptCandidate).toBe(true);
  });

  it("does not set isExemptCandidate for a non-PPF interest row just because the DB column happens to be true", () => {
    // isExemptCandidate is a plain per-row flag — it has no special
    // coupling to category at all; this documents that mapping is
    // category-agnostic, not that any category is treated specially.
    const mapped = mapTaxIncomeAdjustmentRow(
      incomeRow({ category: "savings_interest", is_exempt_candidate: true }),
    );
    expect(mapped.isExemptCandidate).toBe(true);
    expect(mapped.category).toBe("savings_interest");
  });
});

describe("isProfileWithinSupportedScope", () => {
  const base: TaxProfile = mapTaxProfileRow(profileRow());

  it("is in scope for a resident individual with no business/professional income", () => {
    expect(isProfileWithinSupportedScope(base)).toBe(true);
  });

  it("is out of scope once business/professional income is present", () => {
    const profile = mapTaxProfileRow(
      profileRow({ has_business_or_professional_income: true }),
    );
    expect(isProfileWithinSupportedScope(profile)).toBe(false);
  });

  it("is out of scope for a non-resident", () => {
    const profile = mapTaxProfileRow(
      profileRow({ residential_status: "non_resident" }),
    );
    expect(isProfileWithinSupportedScope(profile)).toBe(false);
  });

  it("is out of scope for resident-not-ordinarily-resident", () => {
    const profile = mapTaxProfileRow(
      profileRow({
        residential_status: "resident_not_ordinarily_resident",
      }),
    );
    expect(isProfileWithinSupportedScope(profile)).toBe(false);
  });
});
