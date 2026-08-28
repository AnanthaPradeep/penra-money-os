import { Decimal, type Money } from "@/lib/money/decimal";

/**
 * A pure, deterministic FIFO tax-lot engine — completely independent of
 * Phase 7's weighted-average accounting cost basis (see
 * public.investment_holding_position in supabase/migrations/
 * 20260820184332_phase7_investments_networth.sql). That function answers
 * "what is this holding worth for portfolio/net-worth purposes right
 * now" using a running weighted average; this module answers "which
 * specific purchase paid for which specific sale" for capital-gains tax
 * purposes, using FIFO (first-in-first-out) lot matching — the method
 * required for demat/dematerialised securities under Indian tax rules.
 * Neither reads nor writes the other's output. Nothing here ever writes
 * to investment_activities/investment_holdings — it only reads
 * already-fetched, already-posted activity data the caller supplies.
 *
 * Reversal handling: Phase 7 never deletes or edits an activity row — a
 * reversal is a second row with `reversal_of` set and negated amounts,
 * while the original gets `reversed_by` set (see
 * public.reverse_investment_activity). Rather than feed negated
 * quantities through FIFO matching (which has no sensible "negative buy"
 * or "negative sell" semantics), this engine excludes BOTH members of a
 * reversed pair entirely before lot-building — a reversed activity is
 * treated as though it never happened, which is exactly what a reversal
 * means. See `selectEffectiveActivities`.
 *
 * A holding with any 'adjustment' activity (used today for corporate
 * actions PENRA has no structured support for — bonus shares, splits,
 * demergers, rights issues, and the like) is marked wholly "partial" with
 * `unsupportedAdjustmentPresent: true` rather than silently FIFO-matching
 * around it, since an adjustment's real tax treatment cannot be inferred
 * from a bare quantity/cost-basis delta.
 *
 * A holding whose effective activities carry more than one distinct
 * `currency` (investment_activities.currency, independent of
 * investment_holdings.currency — the data model allows them to differ
 * per row) is likewise never FIFO-matched: Decimal arithmetic has no
 * concept of currency, so blending e.g. INR and USD amounts in the same
 * cost/proceeds calculation would silently produce a number that looks
 * exact but means nothing. This is checked and short-circuited BEFORE any
 * lot matching runs, so no arithmetic ever crosses a currency boundary —
 * see `hasMixedCurrency`.
 */

export type TaxLotActivityKind = "buy" | "sell";

export type TaxLotActivityInput = {
  id: string;
  kind: TaxLotActivityKind;
  tradeDate: string;
  createdAt: string;
  quantity: Money;
  grossAmount: Money;
  feeAmount: Money;
  taxAmount: Money;
  currency: string;
  reversalOf: string | null;
  reversedBy: string | null;
};

export type TaxLot = {
  id: string;
  sourceActivityId: string;
  acquisitionDate: string;
  originalQuantity: Money;
  remainingQuantity: Money;
  costPerUnit: Money;
};

export type LotConsumption = {
  lotId: string;
  sourceActivityId: string;
  acquisitionDate: string;
  quantityConsumed: Money;
  acquisitionCostConsumed: Money;
  grossProceedsApportioned: Money;
  feeApportioned: Money;
  taxApportioned: Money;
  gainOrLoss: Money;
};

export type TaxDisposal = {
  disposalActivityId: string;
  disposalDate: string;
  quantityDisposed: Money;
  quantityMatched: Money;
  quantityUnmatched: Money;
  consumptions: LotConsumption[];
  status: "matched" | "needs_review";
};

export type TaxLotEngineResult = {
  disposals: TaxDisposal[];
  remainingLots: TaxLot[];
  unsupportedAdjustmentPresent: boolean;
  hasMixedCurrency: boolean;
  status: "complete" | "partial";
};

const ZERO = new Decimal(0);

/** Excludes both members of every reversed activity pair — see the module comment for why this, not negated-quantity FIFO, is correct. */
function selectEffectiveActivities(
  activities: TaxLotActivityInput[],
): TaxLotActivityInput[] {
  return activities.filter(
    (a) => a.reversalOf === null && a.reversedBy === null,
  );
}

function sortChronologically(
  activities: TaxLotActivityInput[],
): TaxLotActivityInput[] {
  return [...activities].sort((a, b) => {
    if (a.tradeDate !== b.tradeDate) {
      return a.tradeDate < b.tradeDate ? -1 : 1;
    }
    return a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0;
  });
}

/**
 * Runs FIFO lot matching over one holding's effective (non-reversed,
 * non-reversal) buy/sell activities, plus a flag for whether any
 * unsupported 'adjustment' activity exists on the same holding (the
 * caller passes that in separately, since adjustments are outside this
 * function's own buy/sell input shape).
 */
export function runFifoTaxLotEngine(
  activities: TaxLotActivityInput[],
  hasAdjustmentActivity: boolean,
): TaxLotEngineResult {
  const effective = sortChronologically(selectEffectiveActivities(activities));

  const distinctCurrencies = new Set(effective.map((a) => a.currency));
  if (distinctCurrencies.size > 1) {
    return {
      disposals: [],
      remainingLots: [],
      unsupportedAdjustmentPresent: hasAdjustmentActivity,
      hasMixedCurrency: true,
      status: "partial",
    };
  }

  const lots: TaxLot[] = [];
  const disposals: TaxDisposal[] = [];
  let anyUnmatched = false;

  for (const activity of effective) {
    if (activity.kind === "buy") {
      if (activity.quantity.lte(0)) {
        continue;
      }
      const costPerUnit = activity.grossAmount
        .plus(activity.feeAmount)
        .dividedBy(activity.quantity);
      lots.push({
        id: `lot:${activity.id}`,
        sourceActivityId: activity.id,
        acquisitionDate: activity.tradeDate,
        originalQuantity: activity.quantity,
        remainingQuantity: activity.quantity,
        costPerUnit,
      });
      continue;
    }

    // sell
    let remainingToMatch = activity.quantity;
    const consumptions: LotConsumption[] = [];
    const unitPrice = activity.quantity.gt(0)
      ? activity.grossAmount.dividedBy(activity.quantity)
      : ZERO;

    for (const lot of lots) {
      if (remainingToMatch.lte(0)) {
        break;
      }
      if (lot.remainingQuantity.lte(0)) {
        continue;
      }
      const consumedQuantity = Decimal.min(
        lot.remainingQuantity,
        remainingToMatch,
      );
      const acquisitionCostConsumed = lot.costPerUnit.times(consumedQuantity);
      const grossProceedsApportioned = unitPrice.times(consumedQuantity);
      const shareOfSale = activity.quantity.gt(0)
        ? consumedQuantity.dividedBy(activity.quantity)
        : ZERO;
      const feeApportioned = activity.feeAmount.times(shareOfSale);
      const taxApportioned = activity.taxAmount.times(shareOfSale);
      const netProceeds = grossProceedsApportioned
        .minus(feeApportioned)
        .minus(taxApportioned);
      const gainOrLoss = netProceeds.minus(acquisitionCostConsumed);

      consumptions.push({
        lotId: lot.id,
        sourceActivityId: lot.sourceActivityId,
        acquisitionDate: lot.acquisitionDate,
        quantityConsumed: consumedQuantity,
        acquisitionCostConsumed,
        grossProceedsApportioned,
        feeApportioned,
        taxApportioned,
        gainOrLoss,
      });

      lot.remainingQuantity = lot.remainingQuantity.minus(consumedQuantity);
      remainingToMatch = remainingToMatch.minus(consumedQuantity);
    }

    const quantityMatched = activity.quantity.minus(remainingToMatch);
    const quantityUnmatched = remainingToMatch.gt(0) ? remainingToMatch : ZERO;
    if (quantityUnmatched.gt(0)) {
      anyUnmatched = true;
    }

    disposals.push({
      disposalActivityId: activity.id,
      disposalDate: activity.tradeDate,
      quantityDisposed: activity.quantity,
      quantityMatched,
      quantityUnmatched,
      consumptions,
      status: quantityUnmatched.gt(0) ? "needs_review" : "matched",
    });
  }

  const remainingLots = lots.filter((lot) => lot.remainingQuantity.gt(0));

  return {
    disposals,
    remainingLots,
    unsupportedAdjustmentPresent: hasAdjustmentActivity,
    hasMixedCurrency: false,
    status: anyUnmatched || hasAdjustmentActivity ? "partial" : "complete",
  };
}
