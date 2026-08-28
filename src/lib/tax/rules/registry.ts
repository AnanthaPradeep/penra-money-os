import { FY_2024_25 } from "@/lib/tax/rules/fy2024-25";
import { FY_2025_26 } from "@/lib/tax/rules/fy2025-26";
import type { TaxRuleSet } from "@/lib/tax/rules/types";

/**
 * The registry of every financial year this app has a versioned,
 * authoritative tax rule set for — a plain, frozen, source-controlled
 * object literal, not a database table. This is deliberate: rule sets
 * ship as part of an application release (reviewed like any other code
 * change via a pull request), so no browser role — not even an
 * authenticated one — can ever forge or alter a shared tax rule, and a
 * historical calculation's rule set can never silently change underneath
 * it the way a mutable database row could. `Object.freeze` on the
 * registry and every rule set catches an accidental in-process mutation
 * during development; it is not itself the security boundary (nothing in
 * this module is reachable from the browser at all — see
 * src/lib/tax/rules/registry.test.ts's "historical rule-set immutability"
 * tests for what is actually being proven).
 *
 * FY 2026-27 (the current financial year at the time this phase was
 * built) is deliberately NOT registered — no confirmed, authoritative
 * Union Budget rule text for it was available when this rule set was
 * written, and this project's own rule is "a missing tax rule must
 * produce an explicit unavailable result, never a guessed number." Once
 * FY 2026-27's Finance Act is enacted, add a new fy2026-27.ts module and
 * register it here — never edit fy2025-26.ts to "extend" it forward.
 */
const RULE_SETS: Readonly<Record<string, TaxRuleSet>> = Object.freeze({
  "2024-25": Object.freeze(FY_2024_25),
  "2025-26": Object.freeze(FY_2025_26),
});

/** The taxpayer scope every registered rule set in this app supports — see each rule set's own module comment for the reasoning behind this boundary. */
export const SUPPORTED_TAXPAYER_SCOPE = Object.freeze({
  taxpayerType: "individual",
  residentialStatus: "resident",
  businessOrProfession: false,
  currency: "INR",
} as const);

export type RuleSetLookupResult =
  | { available: true; ruleSet: TaxRuleSet }
  | { available: false; reasonCode: "no_rule_set_for_financial_year" };

/** Looks up the registered rule set for a financial-year id — never falls back to an adjacent year's rules. */
export function getTaxRuleSet(financialYearId: string): RuleSetLookupResult {
  const ruleSet = RULE_SETS[financialYearId];
  if (!ruleSet) {
    return { available: false, reasonCode: "no_rule_set_for_financial_year" };
  }
  return { available: true, ruleSet };
}

/** Every financial-year id this app currently has a registered rule set for, ascending. */
export function listSupportedFinancialYearIds(): string[] {
  return Object.keys(RULE_SETS).sort();
}
