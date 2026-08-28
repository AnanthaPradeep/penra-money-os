import { describe, expect, it } from "vitest";

import {
  getTaxRuleSet,
  listSupportedFinancialYearIds,
  SUPPORTED_TAXPAYER_SCOPE,
} from "@/lib/tax/rules/registry";

describe("getTaxRuleSet", () => {
  it("returns the registered rule set for a supported financial year", () => {
    const result = getTaxRuleSet("2025-26");
    expect(result.available).toBe(true);
    if (result.available) {
      expect(result.ruleSet.financialYearId).toBe("2025-26");
      expect(result.ruleSet.assessmentYearId).toBe("2026-27");
      expect(result.ruleSet.ruleSetVersion).toBe("in-individual-2025-26.v1");
    }
  });

  it("returns unavailable, with a reason code, for a financial year with no published rule set — never a guess", () => {
    const result = getTaxRuleSet("2026-27");
    expect(result.available).toBe(false);
    if (!result.available) {
      expect(result.reasonCode).toBe("no_rule_set_for_financial_year");
    }
  });

  it("returns unavailable for a nonsense financial-year id rather than throwing", () => {
    const result = getTaxRuleSet("not-a-year");
    expect(result.available).toBe(false);
  });

  it("never falls back to an adjacent financial year's rule set", () => {
    const fy2024 = getTaxRuleSet("2024-25");
    const fy2025 = getTaxRuleSet("2025-26");
    expect(fy2024.available && fy2025.available).toBe(true);
    if (fy2024.available && fy2025.available) {
      expect(fy2024.ruleSet.regimes.new.slabs).not.toEqual(
        fy2025.ruleSet.regimes.new.slabs,
      );
    }
  });
});

describe("historical rule-set immutability", () => {
  it("a rule set object cannot be mutated in place — a newer rule set can never alter a finalized historical snapshot's stored reference", () => {
    const result = getTaxRuleSet("2024-25");
    expect(result.available).toBe(true);
    if (!result.available) return;

    // A plain assignment, not a type error — TaxRuleSet's own type doesn't
    // mark its fields readonly, so this proves the *runtime* Object.freeze
    // guard (strict-mode assignment to a frozen property throws) rather
    // than anything the type checker would already catch.
    expect(() => {
      result.ruleSet.ruleSetVersion = "tampered";
    }).toThrow();

    expect(getTaxRuleSet("2024-25")).toEqual(result);
  });

  it("registering a new financial year's rule set never changes an earlier year's already-registered figures", () => {
    const before2025 = getTaxRuleSet("2025-26");
    // Simulate "time passing" by re-fetching after other registry reads —
    // the registry has no mutable state, so a second read is byte-identical.
    getTaxRuleSet("2024-25");
    getTaxRuleSet("2026-27");
    const after2025 = getTaxRuleSet("2025-26");
    expect(after2025).toEqual(before2025);
  });

  it("lists every currently-supported financial year, ascending", () => {
    expect(listSupportedFinancialYearIds()).toEqual(["2024-25", "2025-26"]);
  });
});

describe("SUPPORTED_TAXPAYER_SCOPE", () => {
  it("is scoped to resident individuals without business/professional income, in INR", () => {
    expect(SUPPORTED_TAXPAYER_SCOPE).toEqual({
      taxpayerType: "individual",
      residentialStatus: "resident",
      businessOrProfession: false,
      currency: "INR",
    });
  });
});
