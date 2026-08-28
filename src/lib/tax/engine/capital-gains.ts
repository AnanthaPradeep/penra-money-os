import { Decimal, type Money } from "@/lib/money/decimal";
import type { TaxDisposal, TaxLotEngineResult } from "@/lib/tax/engine/tax-lots";
import type {
  CapitalAssetClass,
  CapitalGainTerm,
  TaxRuleSet,
} from "@/lib/tax/rules/types";

/**
 * Classifies each FIFO lot-consumption from tax-lots.ts into short-term or
 * long-term, looks up the applicable special-rate rule for its disposal
 * date (supporting a mid-year statutory rate change, e.g. Budget 2024's
 * 23 July 2024 boundary — see fy2024-25.ts), and aggregates into the
 * category totals a capital-gains report needs. The section-112A LTCG
 * exemption is a single amount applied once across the COMBINED listed-
 * equity + equity-oriented-mutual-fund long-term total for the year —
 * never per instrument, never per transaction — matching how the
 * exemption actually works; this module is the one place that combination
 * happens, so category-level totals (kept separate below, per the "do not
 * net categories in a way that implies legally permitted set-off" rule)
 * are never silently merged anywhere else.
 */

export type CapitalGainLine = {
  disposalActivityId: string;
  lotId: string;
  holdingId: string;
  assetClass: CapitalAssetClass;
  displayName: string;
  isinOrSymbol: string | null;
  acquisitionDate: string;
  disposalDate: string;
  holdingPeriodDays: number;
  term: CapitalGainTerm;
  quantity: Money;
  grossProceeds: Money;
  acquisitionCost: Money;
  transferExpenses: Money;
  rawGain: Money;
  ratePercent: Money | null;
  ruleMatched: boolean;
};

export type CapitalGainCategoryTotal = {
  category:
    | "listed_equity_stcg"
    | "listed_equity_ltcg"
    | "equity_mf_stcg"
    | "equity_mf_ltcg";
  grossGain: Money;
  grossLoss: Money;
  netAmount: Money;
  lineCount: number;
};

export type CapitalGainsReport = {
  lines: CapitalGainLine[];
  categoryTotals: CapitalGainCategoryTotal[];
  /** Combined listed-equity + equity-MF LTCG exemption applied once, u/s 112A. */
  ltcgExemptionApplied: Money;
  ltcgTaxableAfterExemption: Money;
  ltcgSpecialRateTax: Money;
  stcgSpecialRateTax: Money;
  totalGains: Money;
  totalLosses: Money;
  unclassifiedOrUnsupportedCount: number;
  status: "complete" | "partial";
};

const ZERO = new Decimal(0);
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function daysBetween(fromIso: string, toIso: string): number {
  const from = new Date(`${fromIso}T00:00:00Z`).getTime();
  const to = new Date(`${toIso}T00:00:00Z`).getTime();
  return Math.round((to - from) / MS_PER_DAY);
}

function monthsHeld(acquisitionDate: string, disposalDate: string): number {
  const [ay, am] = acquisitionDate.split("-").map(Number);
  const [dy, dm] = disposalDate.split("-").map(Number);
  const acquisitionDay = Number(acquisitionDate.slice(8, 10));
  const disposalDay = Number(disposalDate.slice(8, 10));
  let months = (dy ?? 0) * 12 + (dm ?? 1) - ((ay ?? 0) * 12 + (am ?? 1));
  if (disposalDay < acquisitionDay) {
    months -= 1;
  }
  return months;
}

function classifyTerm(
  ruleSet: TaxRuleSet,
  assetClass: CapitalAssetClass,
  acquisitionDate: string,
  disposalDate: string,
): CapitalGainTerm {
  const threshold = ruleSet.capitalGains.holdingPeriodThresholds.find(
    (t) => t.assetClass === assetClass,
  );
  const months = monthsHeld(acquisitionDate, disposalDate);
  const longTermMonths = threshold?.longTermThresholdMonths ?? 12;
  return months > longTermMonths ? "long_term" : "short_term";
}

function findRateRule(
  ruleSet: TaxRuleSet,
  assetClass: CapitalAssetClass,
  term: CapitalGainTerm,
  disposalDate: string,
) {
  return ruleSet.capitalGains.rates.find(
    (r) =>
      r.assetClass === assetClass &&
      r.term === term &&
      disposalDate >= r.effectiveFrom &&
      (r.effectiveTo === null || disposalDate <= r.effectiveTo),
  );
}

export type DisposalHoldingContext = {
  disposal: TaxDisposal;
  holdingId: string;
  assetClass: CapitalAssetClass;
  displayName: string;
  isinOrSymbol: string | null;
};

/** Builds the full capital-gains report for one financial year from tax-lot engine results across every disposing holding within that year. */
export function buildCapitalGainsReport(
  ruleSet: TaxRuleSet,
  disposalContexts: DisposalHoldingContext[],
  taxLotResultsByHolding: Map<string, TaxLotEngineResult>,
): CapitalGainsReport {
  const lines: CapitalGainLine[] = [];
  let unclassifiedOrUnsupportedCount = 0;

  for (const ctx of disposalContexts) {
    const holdingResult = taxLotResultsByHolding.get(ctx.holdingId);
    if (holdingResult?.unsupportedAdjustmentPresent) {
      unclassifiedOrUnsupportedCount += 1;
      continue;
    }
    for (const consumption of ctx.disposal.consumptions) {
      const term = classifyTerm(
        ruleSet,
        ctx.assetClass,
        consumption.acquisitionDate,
        ctx.disposal.disposalDate,
      );
      const rateRule = findRateRule(
        ruleSet,
        ctx.assetClass,
        term,
        ctx.disposal.disposalDate,
      );
      if (!rateRule) {
        unclassifiedOrUnsupportedCount += 1;
      }
      lines.push({
        disposalActivityId: ctx.disposal.disposalActivityId,
        lotId: consumption.lotId,
        holdingId: ctx.holdingId,
        assetClass: ctx.assetClass,
        displayName: ctx.displayName,
        isinOrSymbol: ctx.isinOrSymbol,
        acquisitionDate: consumption.acquisitionDate,
        disposalDate: ctx.disposal.disposalDate,
        holdingPeriodDays: daysBetween(
          consumption.acquisitionDate,
          ctx.disposal.disposalDate,
        ),
        term,
        quantity: consumption.quantityConsumed,
        grossProceeds: consumption.grossProceedsApportioned,
        acquisitionCost: consumption.acquisitionCostConsumed,
        transferExpenses: consumption.feeApportioned.plus(
          consumption.taxApportioned,
        ),
        rawGain: consumption.gainOrLoss,
        ratePercent: rateRule?.ratePercent ?? null,
        ruleMatched: rateRule !== undefined,
      });
    }
    if (ctx.disposal.status === "needs_review") {
      unclassifiedOrUnsupportedCount += 1;
    }
  }

  const categoryOf = (
    assetClass: CapitalAssetClass,
    term: CapitalGainTerm,
  ): CapitalGainCategoryTotal["category"] =>
    assetClass === "listed_equity"
      ? term === "short_term"
        ? "listed_equity_stcg"
        : "listed_equity_ltcg"
      : term === "short_term"
        ? "equity_mf_stcg"
        : "equity_mf_ltcg";

  const categories: CapitalGainCategoryTotal["category"][] = [
    "listed_equity_stcg",
    "listed_equity_ltcg",
    "equity_mf_stcg",
    "equity_mf_ltcg",
  ];
  const categoryTotals: CapitalGainCategoryTotal[] = categories.map((category) => {
    const matching = lines.filter(
      (l) => categoryOf(l.assetClass, l.term) === category,
    );
    const grossGain = matching
      .filter((l) => l.rawGain.gt(0))
      .reduce((sum, l) => sum.plus(l.rawGain), ZERO);
    const grossLoss = matching
      .filter((l) => l.rawGain.lt(0))
      .reduce((sum, l) => sum.plus(l.rawGain.abs()), ZERO);
    return {
      category,
      grossGain,
      grossLoss,
      netAmount: grossGain.minus(grossLoss),
      lineCount: matching.length,
    };
  });

  const ltcgLines = lines.filter((l) => l.term === "long_term");
  const ltcgNet = ltcgLines.reduce((sum, l) => sum.plus(l.rawGain), ZERO);
  const stcgLines = lines.filter((l) => l.term === "short_term");

  // The u/s 112A exemption is a single combined threshold — applied once
  // against the net LTCG total, never per line, never per asset class.
  const exemptionCandidate = ruleSet.capitalGains.rates.find(
    (r) => r.term === "long_term" && r.exemptionAmount !== null,
  )?.exemptionAmount;
  const ltcgExemptionApplied =
    ltcgNet.gt(0) && exemptionCandidate
      ? Decimal.min(ltcgNet, exemptionCandidate)
      : ZERO;
  const ltcgTaxableAfterExemption = ltcgNet.gt(0)
    ? ltcgNet.minus(ltcgExemptionApplied)
    : ZERO;

  // Special-rate tax uses each line's own matched rate (supports a
  // mid-year rate change within one financial year) — the exemption is
  // subtracted proportionally from the taxable total rather than
  // per-line, since it is legally a single combined threshold, not a
  // per-transaction one.
  const ltcgGrossPositive = ltcgLines
    .filter((l) => l.rawGain.gt(0))
    .reduce((sum, l) => sum.plus(l.rawGain), ZERO);
  const ltcgSpecialRateTax = ltcgLines
    .filter((l) => l.rawGain.gt(0) && l.ratePercent !== null)
    .reduce((sum, l) => {
      const shareOfLtcg = ltcgGrossPositive.gt(0)
        ? l.rawGain.dividedBy(ltcgGrossPositive)
        : ZERO;
      const taxableShare = ltcgTaxableAfterExemption.times(shareOfLtcg);
      return sum.plus(taxableShare.times(l.ratePercent!).dividedBy(100));
    }, ZERO);

  const stcgSpecialRateTax = stcgLines
    .filter((l) => l.rawGain.gt(0) && l.ratePercent !== null)
    .reduce(
      (sum, l) => sum.plus(l.rawGain.times(l.ratePercent!).dividedBy(100)),
      ZERO,
    );

  const totalGains = lines
    .filter((l) => l.rawGain.gt(0))
    .reduce((sum, l) => sum.plus(l.rawGain), ZERO);
  const totalLosses = lines
    .filter((l) => l.rawGain.lt(0))
    .reduce((sum, l) => sum.plus(l.rawGain.abs()), ZERO);

  return {
    lines,
    categoryTotals,
    ltcgExemptionApplied,
    ltcgTaxableAfterExemption,
    ltcgSpecialRateTax,
    stcgSpecialRateTax,
    totalGains,
    totalLosses,
    unclassifiedOrUnsupportedCount,
    status: unclassifiedOrUnsupportedCount > 0 ? "partial" : "complete",
  };
}
