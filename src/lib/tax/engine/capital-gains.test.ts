import { describe, expect, it } from "vitest";

import { assertDefined } from "@/test/assert";
import { Decimal } from "@/lib/money/decimal";
import {
  buildCapitalGainsReport,
  type DisposalHoldingContext,
} from "@/lib/tax/engine/capital-gains";
import {
  runFifoTaxLotEngine,
  type TaxLotActivityInput,
} from "@/lib/tax/engine/tax-lots";
import { FY_2024_25 } from "@/lib/tax/rules/fy2024-25";
import { FY_2025_26 } from "@/lib/tax/rules/fy2025-26";

function activity(
  overrides: Partial<TaxLotActivityInput> = {},
): TaxLotActivityInput {
  return {
    id: "a1",
    kind: "buy",
    tradeDate: "2024-01-01",
    createdAt: "2024-01-01T00:00:00.000Z",
    quantity: new Decimal(10),
    grossAmount: new Decimal(1000),
    feeAmount: new Decimal(0),
    taxAmount: new Decimal(0),
    currency: "INR",
    reversalOf: null,
    reversedBy: null,
    ...overrides,
  };
}

function ctx(
  overrides: Partial<DisposalHoldingContext> = {},
): DisposalHoldingContext {
  return {
    disposal: {
      disposalActivityId: "sell1",
      disposalDate: "2025-09-01",
      quantityDisposed: new Decimal(10),
      quantityMatched: new Decimal(10),
      quantityUnmatched: new Decimal(0),
      consumptions: [],
      status: "matched",
    },
    holdingId: "holding1",
    assetClass: "listed_equity",
    displayName: "Example Corp",
    isinOrSymbol: "INE000A00000",
    ...overrides,
  };
}

describe("buildCapitalGainsReport — term classification", () => {
  it("classifies a disposal held over 12 months as long_term", () => {
    const buy = activity({
      id: "buy1",
      tradeDate: "2024-01-01",
      createdAt: "2024-01-01T00:00:00.000Z",
      quantity: new Decimal(10),
      grossAmount: new Decimal(1000),
    });
    const sell = activity({
      id: "sell1",
      kind: "sell",
      tradeDate: "2025-06-01",
      quantity: new Decimal(10),
      grossAmount: new Decimal(1500),
    });
    const lotResult = runFifoTaxLotEngine([buy, sell], false);
    const disposal = assertDefined(lotResult.disposals[0]);
    const map = new Map([["holding1", lotResult]]);
    const report = buildCapitalGainsReport(
      FY_2025_26,
      [ctx({ disposal, holdingId: "holding1" })],
      map,
    );
    expect(assertDefined(report.lines[0]).term).toBe("long_term");
  });

  it("classifies a disposal held under 12 months as short_term", () => {
    const buy = activity({
      id: "buy1",
      tradeDate: "2025-01-01",
      createdAt: "2025-01-01T00:00:00.000Z",
      quantity: new Decimal(10),
      grossAmount: new Decimal(1000),
    });
    const sell = activity({
      id: "sell1",
      kind: "sell",
      tradeDate: "2025-06-01",
      quantity: new Decimal(10),
      grossAmount: new Decimal(1500),
    });
    const lotResult = runFifoTaxLotEngine([buy, sell], false);
    const disposal = assertDefined(lotResult.disposals[0]);
    const map = new Map([["holding1", lotResult]]);
    const report = buildCapitalGainsReport(
      FY_2025_26,
      [ctx({ disposal, holdingId: "holding1" })],
      map,
    );
    expect(assertDefined(report.lines[0]).term).toBe("short_term");
  });
});

describe("buildCapitalGainsReport — mid-year rate change (FY2024-25)", () => {
  it("applies the pre-23-July-2024 LTCG rate to a disposal before the change", () => {
    const buy = activity({
      id: "buy1",
      tradeDate: "2022-01-01",
      createdAt: "2022-01-01T00:00:00.000Z",
      quantity: new Decimal(10),
      grossAmount: new Decimal(1000),
    });
    const sell = activity({
      id: "sell1",
      kind: "sell",
      tradeDate: "2024-06-01",
      quantity: new Decimal(10),
      grossAmount: new Decimal(2000),
    });
    const lotResult = runFifoTaxLotEngine([buy, sell], false);
    const disposal = assertDefined(lotResult.disposals[0]);
    const map = new Map([["holding1", lotResult]]);
    const report = buildCapitalGainsReport(
      FY_2024_25,
      [ctx({ disposal, holdingId: "holding1" })],
      map,
    );
    expect(assertDefined(report.lines[0]).ratePercent?.toString()).toBe("10");
  });

  it("applies the post-23-July-2024 LTCG rate to a disposal on or after the change", () => {
    const buy = activity({
      id: "buy1",
      tradeDate: "2022-01-01",
      createdAt: "2022-01-01T00:00:00.000Z",
      quantity: new Decimal(10),
      grossAmount: new Decimal(1000),
    });
    const sell = activity({
      id: "sell1",
      kind: "sell",
      tradeDate: "2024-07-23",
      quantity: new Decimal(10),
      grossAmount: new Decimal(2000),
    });
    const lotResult = runFifoTaxLotEngine([buy, sell], false);
    const disposal = assertDefined(lotResult.disposals[0]);
    const map = new Map([["holding1", lotResult]]);
    const report = buildCapitalGainsReport(
      FY_2024_25,
      [ctx({ disposal, holdingId: "holding1" })],
      map,
    );
    expect(assertDefined(report.lines[0]).ratePercent?.toString()).toBe("12.5");
  });
});

describe("buildCapitalGainsReport — u/s 112A exemption, applied once in aggregate", () => {
  it("exempts LTCG up to the combined threshold across two different holdings", () => {
    const buy1 = activity({
      id: "buy1",
      tradeDate: "2022-01-01",
      createdAt: "2022-01-01T00:00:00.000Z",
      quantity: new Decimal(10),
      grossAmount: new Decimal(100000),
    });
    const sell1 = activity({
      id: "sell1",
      kind: "sell",
      tradeDate: "2025-09-01",
      quantity: new Decimal(10),
      grossAmount: new Decimal(180000),
    }); // +80,000 gain
    const lot1 = runFifoTaxLotEngine([buy1, sell1], false);

    const buy2 = activity({
      id: "buy2",
      tradeDate: "2022-01-01",
      createdAt: "2022-01-01T00:00:00.000Z",
      quantity: new Decimal(10),
      grossAmount: new Decimal(50000),
    });
    const sell2 = activity({
      id: "sell2",
      kind: "sell",
      tradeDate: "2025-09-01",
      quantity: new Decimal(10),
      grossAmount: new Decimal(110000),
    }); // +60,000 gain
    const lot2 = runFifoTaxLotEngine([buy2, sell2], false);

    const map = new Map([
      ["holding1", lot1],
      ["holding2", lot2],
    ]);
    const report = buildCapitalGainsReport(
      FY_2025_26,
      [
        ctx({
          disposal: assertDefined(lot1.disposals[0]),
          holdingId: "holding1",
        }),
        ctx({
          disposal: assertDefined(lot2.disposals[0]),
          holdingId: "holding2",
          assetClass: "equity_oriented_mutual_fund",
          displayName: "Example Fund",
        }),
      ],
      map,
    );

    // Combined LTCG = 80,000 + 60,000 = 140,000. Exemption = 125,000 (the
    // full threshold, not 125,000 per holding). Taxable = 15,000.
    expect(report.ltcgExemptionApplied.toString()).toBe("125000");
    expect(report.ltcgTaxableAfterExemption.toString()).toBe("15000");
    // Tax = 15,000 * 12.5% = 1875.
    expect(report.ltcgSpecialRateTax.toString()).toBe("1875");
  });

  it("applies zero exemption when there is no LTCG at all", () => {
    const buy = activity({
      id: "buy1",
      tradeDate: "2025-01-01",
      createdAt: "2025-01-01T00:00:00.000Z",
      quantity: new Decimal(10),
      grossAmount: new Decimal(1000),
    });
    const sell = activity({
      id: "sell1",
      kind: "sell",
      tradeDate: "2025-06-01",
      quantity: new Decimal(10),
      grossAmount: new Decimal(1200),
    });
    const lotResult = runFifoTaxLotEngine([buy, sell], false);
    const disposal = assertDefined(lotResult.disposals[0]);
    const map = new Map([["holding1", lotResult]]);
    const report = buildCapitalGainsReport(
      FY_2025_26,
      [ctx({ disposal, holdingId: "holding1" })],
      map,
    );
    expect(report.ltcgExemptionApplied.toString()).toBe("0");
  });
});

describe("buildCapitalGainsReport — category totals never net STCG against LTCG", () => {
  it("keeps STCG and LTCG category totals fully separate", () => {
    const buyLong = activity({
      id: "buyL",
      tradeDate: "2022-01-01",
      createdAt: "2022-01-01T00:00:00.000Z",
      quantity: new Decimal(10),
      grossAmount: new Decimal(1000),
    });
    const sellLong = activity({
      id: "sellL",
      kind: "sell",
      tradeDate: "2025-09-01",
      quantity: new Decimal(10),
      grossAmount: new Decimal(1500),
    });
    const lotLong = runFifoTaxLotEngine([buyLong, sellLong], false);

    const buyShort = activity({
      id: "buyS",
      tradeDate: "2025-06-01",
      createdAt: "2025-06-01T00:00:00.000Z",
      quantity: new Decimal(10),
      grossAmount: new Decimal(1000),
    });
    const sellShort = activity({
      id: "sellS",
      kind: "sell",
      tradeDate: "2025-09-01",
      quantity: new Decimal(10),
      grossAmount: new Decimal(1200),
    });
    const lotShort = runFifoTaxLotEngine([buyShort, sellShort], false);

    const map = new Map([
      ["h1", lotLong],
      ["h2", lotShort],
    ]);
    const report = buildCapitalGainsReport(
      FY_2025_26,
      [
        ctx({ disposal: assertDefined(lotLong.disposals[0]), holdingId: "h1" }),
        ctx({
          disposal: assertDefined(lotShort.disposals[0]),
          holdingId: "h2",
        }),
      ],
      map,
    );

    const ltcg = assertDefined(
      report.categoryTotals.find((c) => c.category === "listed_equity_ltcg"),
    );
    const stcg = assertDefined(
      report.categoryTotals.find((c) => c.category === "listed_equity_stcg"),
    );
    expect(ltcg.netAmount.toString()).toBe("500");
    expect(stcg.netAmount.toString()).toBe("200");
  });
});

describe("buildCapitalGainsReport — unsupported/needs-review handling", () => {
  it("excludes an unsupported-adjustment holding's lines from classification and flags it", () => {
    const buy = activity({
      id: "buy1",
      quantity: new Decimal(10),
      grossAmount: new Decimal(1000),
    });
    const sell = activity({
      id: "sell1",
      kind: "sell",
      tradeDate: "2025-09-01",
      quantity: new Decimal(10),
      grossAmount: new Decimal(1500),
    });
    const lotResult = runFifoTaxLotEngine([buy, sell], true); // hasAdjustmentActivity = true
    const disposal = assertDefined(lotResult.disposals[0]);
    const map = new Map([["holding1", lotResult]]);
    const report = buildCapitalGainsReport(
      FY_2025_26,
      [ctx({ disposal, holdingId: "holding1" })],
      map,
    );
    expect(report.lines).toHaveLength(0);
    expect(report.unclassifiedOrUnsupportedCount).toBe(1);
    expect(report.status).toBe("partial");
  });

  it("stays complete when every disposal is fully matched and rate-classified", () => {
    const buy = activity({
      id: "buy1",
      tradeDate: "2022-01-01",
      createdAt: "2022-01-01T00:00:00.000Z",
      quantity: new Decimal(10),
      grossAmount: new Decimal(1000),
    });
    const sell = activity({
      id: "sell1",
      kind: "sell",
      tradeDate: "2025-09-01",
      quantity: new Decimal(10),
      grossAmount: new Decimal(1500),
    });
    const lotResult = runFifoTaxLotEngine([buy, sell], false);
    const disposal = assertDefined(lotResult.disposals[0]);
    const map = new Map([["holding1", lotResult]]);
    const report = buildCapitalGainsReport(
      FY_2025_26,
      [ctx({ disposal, holdingId: "holding1" })],
      map,
    );
    expect(report.status).toBe("complete");
  });
});

describe("buildCapitalGainsReport — exactness", () => {
  it("never produces NaN or Infinity", () => {
    const buy = activity({
      id: "buy1",
      tradeDate: "2022-01-01",
      createdAt: "2022-01-01T00:00:00.000Z",
      quantity: new Decimal("3.5"),
      grossAmount: new Decimal("333.33"),
    });
    const sell = activity({
      id: "sell1",
      kind: "sell",
      tradeDate: "2025-09-01",
      quantity: new Decimal("3.5"),
      grossAmount: new Decimal("555.55"),
    });
    const lotResult = runFifoTaxLotEngine([buy, sell], false);
    const disposal = assertDefined(lotResult.disposals[0]);
    const map = new Map([["holding1", lotResult]]);
    const report = buildCapitalGainsReport(
      FY_2025_26,
      [ctx({ disposal, holdingId: "holding1" })],
      map,
    );
    expect(report.totalGains.isFinite()).toBe(true);
    expect(report.ltcgSpecialRateTax.isFinite()).toBe(true);
  });
});
