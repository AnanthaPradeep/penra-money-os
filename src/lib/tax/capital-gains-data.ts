import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { Decimal } from "@/lib/money/decimal";
import {
  buildCapitalGainsReport,
  type CapitalGainsReport,
  type DisposalHoldingContext,
} from "@/lib/tax/engine/capital-gains";
import { runFifoTaxLotEngine, type TaxLotActivityInput } from "@/lib/tax/engine/tax-lots";
import type { FinancialYear } from "@/lib/tax/financial-year";
import type { CapitalAssetClass, TaxRuleSet } from "@/lib/tax/rules/types";
import type { Database } from "@/types/database.types";

type HoldingRow = {
  id: string;
  investment_asset_id: string;
  investment_assets: {
    display_name: string;
    isin: string | null;
    symbol: string | null;
  } | null;
};

type ActivityRow = {
  id: string;
  holding_id: string;
  activity_kind: string;
  trade_date: string;
  created_at: string;
  quantity: number | null;
  gross_amount: number;
  fee_amount: number;
  tax_amount: number;
  currency: string;
  reversal_of: string | null;
  reversed_by: string | null;
};

/**
 * Assembles the real, already-posted investment activity data this user
 * has, runs it through the FIFO tax-lot engine (src/lib/tax/engine/tax-
 * lots.ts) and the capital-gains classifier (capital-gains.ts), and
 * returns a financial-year-scoped report. Only holdings the user has
 * explicitly classified via tax_asset_classifications as listed_equity or
 * equity_oriented_mutual_fund are included — an unclassified holding
 * never silently defaults into the report (see this migration's own
 * comment on tax_asset_classifications).
 */
export async function getCapitalGainsReportForYear(
  supabase: SupabaseClient<Database>,
  ruleSet: TaxRuleSet,
  fy: FinancialYear,
): Promise<{
  report: CapitalGainsReport;
  unclassifiedHoldingCount: number;
  mixedCurrencyHoldingCount: number;
}> {
  const [holdingsResult, classificationsResult] = await Promise.all([
    supabase
      .from("investment_holdings")
      .select("id, investment_asset_id, investment_assets(display_name, isin, symbol)")
      .eq("status", "active"),
    supabase.from("tax_asset_classifications").select("*"),
  ]);

  const holdings = (holdingsResult.data ?? []) as unknown as HoldingRow[];
  const classifications = classificationsResult.data ?? [];
  const classificationByAssetId = new Map(
    classifications.map((c) => [c.investment_asset_id, c]),
  );

  const disposalContexts: DisposalHoldingContext[] = [];
  const taxLotResultsByHolding = new Map<
    string,
    ReturnType<typeof runFifoTaxLotEngine>
  >();
  let unclassifiedHoldingCount = 0;
  let mixedCurrencyHoldingCount = 0;

  for (const holding of holdings) {
    const classification = classificationByAssetId.get(holding.investment_asset_id);
    if (!classification) {
      unclassifiedHoldingCount += 1;
      continue;
    }
    if (classification.asset_class === "unsupported") {
      continue;
    }
    const assetClass = classification.asset_class as CapitalAssetClass;

    const { data: activityRows } = await supabase
      .from("investment_activities")
      .select(
        "id, holding_id, activity_kind, trade_date, created_at, quantity, gross_amount, fee_amount, tax_amount, currency, reversal_of, reversed_by",
      )
      .eq("holding_id", holding.id)
      .in("activity_kind", ["buy", "sell", "adjustment"]);

    const rows = (activityRows ?? []) as ActivityRow[];
    const hasAdjustment = rows.some((r) => r.activity_kind === "adjustment");

    const lotActivities: TaxLotActivityInput[] = rows
      .filter((r) => r.activity_kind === "buy" || r.activity_kind === "sell")
      .map((r) => ({
        id: r.id,
        kind: r.activity_kind as "buy" | "sell",
        tradeDate: r.trade_date,
        createdAt: r.created_at,
        quantity: new Decimal(r.quantity ?? 0),
        grossAmount: new Decimal(r.gross_amount),
        feeAmount: new Decimal(r.fee_amount),
        taxAmount: new Decimal(r.tax_amount),
        currency: r.currency,
        reversalOf: r.reversal_of,
        reversedBy: r.reversed_by,
      }));

    const lotResult = runFifoTaxLotEngine(lotActivities, hasAdjustment);
    taxLotResultsByHolding.set(holding.id, lotResult);

    if (lotResult.hasMixedCurrency) {
      mixedCurrencyHoldingCount += 1;
    }

    for (const disposal of lotResult.disposals) {
      if (disposal.disposalDate < fy.startDate || disposal.disposalDate > fy.endDate) {
        continue;
      }
      disposalContexts.push({
        disposal,
        holdingId: holding.id,
        assetClass,
        displayName: holding.investment_assets?.display_name ?? "Unknown holding",
        isinOrSymbol:
          holding.investment_assets?.isin ?? holding.investment_assets?.symbol ?? null,
      });
    }
  }

  const report = buildCapitalGainsReport(ruleSet, disposalContexts, taxLotResultsByHolding);
  return { report, unclassifiedHoldingCount, mixedCurrencyHoldingCount };
}
