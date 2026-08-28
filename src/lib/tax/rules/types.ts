import type { Money } from "@/lib/money/decimal";

/**
 * The typed shape of one immutable, versioned Indian individual-taxpayer
 * rule set. Every concrete rule set lives in its own source-controlled
 * module under src/lib/tax/rules/ (e.g. fy2025-26.ts) — never in the
 * database, so a rule set ships as part of an application release and is
 * reviewed like any other code change, and a browser role can never alter
 * it (see the registry's own module comment for why this satisfies "shared
 * tax rules cannot be modified by browser roles").
 *
 * Scope, deliberately narrow (see REGISTRY_SCOPE in registry.ts): resident
 * individuals with salary/other-source income, not carrying on business or
 * a profession, filing in INR. A rule set for any other profile is simply
 * never registered — see registry.ts's `unsupported reason codes`.
 */

export type TaxRegimeKind = "old" | "new";

export type TaxpayerScope = {
  taxpayerType: "individual";
  residentialStatus: "resident";
  businessOrProfession: false;
  currency: "INR";
};

/** One ordinary-income slab band. `to === null` means "and above" — the top band. */
export type SlabBand = {
  from: Money;
  to: Money | null;
  ratePercent: Money;
};

export type RebateRule = {
  /** Rebate applies in full when taxable ordinary income is at or below this. */
  thresholdIncome: Money;
  maxRebateAmount: Money;
  /** Statutory section, e.g. "87A". */
  section: string;
};

export type RegimeRules = {
  slabs: SlabBand[];
  rebate: RebateRule;
  /** Standard deduction against salary/pension income, if this regime allows one. */
  standardDeduction: Money | null;
  cessPercent: Money;
  /**
   * Surcharge is only calculated up to (and including) this taxable-income
   * threshold — the calculator returns a "partial" result with an explicit
   * reason code above it, rather than approximating surcharge slabs and
   * marginal relief. See CapitalGainsAndRegimeSpec's own module comment
   * for why this line is drawn here.
   */
  surchargeSupportedUpToIncome: Money;
  /** Deduction section codes this regime allows (cross-referenced against deductionCatalog). */
  deductionSectionsAllowed: string[];
};

export type CapitalAssetClass = "listed_equity" | "equity_oriented_mutual_fund";
export type CapitalGainTerm = "short_term" | "long_term";

export type HoldingPeriodThreshold = {
  assetClass: CapitalAssetClass;
  /** Held for strictly more than this many whole months => long_term. */
  longTermThresholdMonths: number;
};

/**
 * A special capital-gains rate effective for part or all of the financial
 * year — plural entries on one asset class/term let a rule set represent a
 * mid-year statutory rate change (e.g. Budget 2024's 23 July 2024 LTCG/STCG
 * rate change) without needing a second financial-year rule set.
 */
export type CapitalGainRateRule = {
  assetClass: CapitalAssetClass;
  term: CapitalGainTerm;
  ratePercent: Money;
  /** Subtracted from long-term gains before applying the rate (u/s 112A) — null when this rate has no exemption (e.g. short-term). */
  exemptionAmount: Money | null;
  /** "YYYY-MM-DD", inclusive. */
  effectiveFrom: string;
  /** "YYYY-MM-DD", inclusive; null means "through the end of this financial year." */
  effectiveTo: string | null;
};

export type DeductionRuleRef = {
  section: string;
  label: string;
  maxAmount: Money | null;
  regimes: TaxRegimeKind[];
};

export type TaxRuleSet = {
  financialYearId: string;
  assessmentYearId: string;
  /** Internal version string for this exact rule set, e.g. "in-individual-2025-26.v1" — recorded on every calculation/snapshot that used it. */
  ruleSetVersion: string;
  effectiveFrom: string;
  effectiveTo: string;
  taxpayerScope: TaxpayerScope;
  regimes: Record<TaxRegimeKind, RegimeRules>;
  capitalGains: {
    holdingPeriodThresholds: HoldingPeriodThreshold[];
    rates: CapitalGainRateRule[];
    grandfatheringSupported: boolean;
    indexationSupported: boolean;
  };
  deductionCatalog: DeductionRuleRef[];
  source: {
    title: string;
    url: string;
    publishedDate: string;
  };
};
