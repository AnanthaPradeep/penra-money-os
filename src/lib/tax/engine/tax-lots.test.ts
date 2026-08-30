import { describe, expect, it } from "vitest";

import { assertDefined } from "@/test/assert";
import { Decimal } from "@/lib/money/decimal";
import {
  runFifoTaxLotEngine,
  type TaxLotActivityInput,
} from "@/lib/tax/engine/tax-lots";

function activity(
  overrides: Partial<TaxLotActivityInput> = {},
): TaxLotActivityInput {
  return {
    id: "a1",
    kind: "buy",
    tradeDate: "2025-06-01",
    createdAt: "2025-06-01T10:00:00.000Z",
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

describe("runFifoTaxLotEngine — basic matching", () => {
  it("matches a single sell fully against a single buy lot and computes the gain", () => {
    const buy = activity({
      id: "buy1",
      kind: "buy",
      tradeDate: "2025-06-01",
      quantity: new Decimal(10),
      grossAmount: new Decimal(1000),
    });
    const sell = activity({
      id: "sell1",
      kind: "sell",
      tradeDate: "2025-09-01",
      createdAt: "2025-09-01T10:00:00.000Z",
      quantity: new Decimal(10),
      grossAmount: new Decimal(1500),
    });

    const result = runFifoTaxLotEngine([buy, sell], false);

    expect(result.status).toBe("complete");
    expect(result.disposals).toHaveLength(1);
    const disposal = assertDefined(result.disposals[0]);
    expect(disposal.status).toBe("matched");
    expect(disposal.quantityMatched.toString()).toBe("10");
    expect(disposal.consumptions).toHaveLength(1);
    const consumption = assertDefined(disposal.consumptions[0]);
    expect(consumption.gainOrLoss.toString()).toBe("500");
    expect(result.remainingLots).toHaveLength(0);
  });

  it("reports a loss when proceeds are below cost", () => {
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
      grossAmount: new Decimal(700),
    });
    const result = runFifoTaxLotEngine([buy, sell], false);
    const disposal = assertDefined(result.disposals[0]);
    const consumption = assertDefined(disposal.consumptions[0]);
    expect(consumption.gainOrLoss.toString()).toBe("-300");
  });

  it("reports exactly zero gain when proceeds equal cost", () => {
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
      grossAmount: new Decimal(1000),
    });
    const result = runFifoTaxLotEngine([buy, sell], false);
    const disposal = assertDefined(result.disposals[0]);
    const consumption = assertDefined(disposal.consumptions[0]);
    expect(consumption.gainOrLoss.toString()).toBe("0");
  });
});

describe("runFifoTaxLotEngine — partial disposal and multiple lots", () => {
  it("consumes lots oldest-first (FIFO) across a partial disposal drawing from multiple lots", () => {
    const buy1 = activity({
      id: "buy1",
      tradeDate: "2025-01-01",
      createdAt: "2025-01-01T00:00:00.000Z",
      quantity: new Decimal(5),
      grossAmount: new Decimal(500),
    });
    const buy2 = activity({
      id: "buy2",
      tradeDate: "2025-03-01",
      createdAt: "2025-03-01T00:00:00.000Z",
      quantity: new Decimal(5),
      grossAmount: new Decimal(600),
    });
    const sell = activity({
      id: "sell1",
      kind: "sell",
      tradeDate: "2025-09-01",
      quantity: new Decimal(8),
      grossAmount: new Decimal(1200),
    });

    const result = runFifoTaxLotEngine([buy1, buy2, sell], false);
    const disposal = assertDefined(result.disposals[0]);
    expect(disposal.consumptions).toHaveLength(2);
    const [consumption1, consumption2] = disposal.consumptions;
    expect(assertDefined(consumption1).sourceActivityId).toBe("buy1");
    expect(assertDefined(consumption1).quantityConsumed.toString()).toBe("5");
    expect(assertDefined(consumption2).sourceActivityId).toBe("buy2");
    expect(assertDefined(consumption2).quantityConsumed.toString()).toBe("3");

    // Remaining lot: buy2 had 5, consumed 3, leaves 2.
    expect(result.remainingLots).toHaveLength(1);
    expect(
      assertDefined(result.remainingLots[0]).remainingQuantity.toString(),
    ).toBe("2");
  });

  it("leaves a partially-consumed lot's remaining quantity available for a later sale", () => {
    const buy = activity({
      id: "buy1",
      quantity: new Decimal(10),
      grossAmount: new Decimal(1000),
    });
    const sell1 = activity({
      id: "sell1",
      kind: "sell",
      tradeDate: "2025-07-01",
      createdAt: "2025-07-01T00:00:00.000Z",
      quantity: new Decimal(4),
      grossAmount: new Decimal(500),
    });
    const sell2 = activity({
      id: "sell2",
      kind: "sell",
      tradeDate: "2025-09-01",
      createdAt: "2025-09-01T00:00:00.000Z",
      quantity: new Decimal(6),
      grossAmount: new Decimal(800),
    });

    const result = runFifoTaxLotEngine([buy, sell1, sell2], false);
    expect(result.disposals).toHaveLength(2);
    const [disposal1, disposal2] = result.disposals;
    const disposal1Consumption = assertDefined(
      assertDefined(disposal1).consumptions[0],
    );
    const disposal2Consumption = assertDefined(
      assertDefined(disposal2).consumptions[0],
    );
    expect(disposal1Consumption.quantityConsumed.toString()).toBe("4");
    expect(disposal2Consumption.quantityConsumed.toString()).toBe("6");
    expect(result.remainingLots).toHaveLength(0);
  });

  it("splits multiple sale lots correctly across several purchase lots (multiple lots, multiple sales)", () => {
    const buy1 = activity({
      id: "buy1",
      tradeDate: "2025-01-01",
      createdAt: "2025-01-01T00:00:00.000Z",
      quantity: new Decimal(3),
      grossAmount: new Decimal(300),
    });
    const buy2 = activity({
      id: "buy2",
      tradeDate: "2025-02-01",
      createdAt: "2025-02-01T00:00:00.000Z",
      quantity: new Decimal(3),
      grossAmount: new Decimal(360),
    });
    const buy3 = activity({
      id: "buy3",
      tradeDate: "2025-03-01",
      createdAt: "2025-03-01T00:00:00.000Z",
      quantity: new Decimal(3),
      grossAmount: new Decimal(390),
    });
    const sell1 = activity({
      id: "sell1",
      kind: "sell",
      tradeDate: "2025-06-01",
      createdAt: "2025-06-01T00:00:00.000Z",
      quantity: new Decimal(4),
      grossAmount: new Decimal(480),
    });
    const sell2 = activity({
      id: "sell2",
      kind: "sell",
      tradeDate: "2025-07-01",
      createdAt: "2025-07-01T00:00:00.000Z",
      quantity: new Decimal(5),
      grossAmount: new Decimal(650),
    });

    const result = runFifoTaxLotEngine([buy1, buy2, buy3, sell1, sell2], false);
    expect(result.status).toBe("complete");
    const [disposal1, disposal2] = result.disposals;
    // sell1 (4 units): 3 from buy1, 1 from buy2.
    expect(
      assertDefined(disposal1).consumptions.map((c) => c.sourceActivityId),
    ).toEqual(["buy1", "buy2"]);
    // sell2 (5 units): remaining 2 from buy2, 3 from buy3.
    expect(
      assertDefined(disposal2).consumptions.map((c) => c.sourceActivityId),
    ).toEqual(["buy2", "buy3"]);
    expect(result.remainingLots).toHaveLength(0);
  });
});

describe("runFifoTaxLotEngine — fee and tax apportionment", () => {
  it("apportions fee and tax across lots exactly proportional to quantity consumed", () => {
    const buy1 = activity({
      id: "buy1",
      tradeDate: "2025-01-01",
      createdAt: "2025-01-01T00:00:00.000Z",
      quantity: new Decimal(4),
      grossAmount: new Decimal(400),
    });
    const buy2 = activity({
      id: "buy2",
      tradeDate: "2025-02-01",
      createdAt: "2025-02-01T00:00:00.000Z",
      quantity: new Decimal(6),
      grossAmount: new Decimal(720),
    });
    const sell = activity({
      id: "sell1",
      kind: "sell",
      tradeDate: "2025-09-01",
      quantity: new Decimal(10),
      grossAmount: new Decimal(1500),
      feeAmount: new Decimal(100),
      taxAmount: new Decimal(50),
    });

    const result = runFifoTaxLotEngine([buy1, buy2, sell], false);
    const disposal = assertDefined(result.disposals[0]);
    const [c1raw, c2raw] = disposal.consumptions;
    const c1 = assertDefined(c1raw);
    const c2 = assertDefined(c2raw);
    // c1 draws 4/10 of the sale => fee 40, tax 20. c2 draws 6/10 => fee 60, tax 30.
    expect(c1.feeApportioned.toString()).toBe("40");
    expect(c1.taxApportioned.toString()).toBe("20");
    expect(c2.feeApportioned.toString()).toBe("60");
    expect(c2.taxApportioned.toString()).toBe("30");
    // Total apportioned fee/tax reconstructs the original sell's totals exactly.
    expect(c1.feeApportioned.plus(c2.feeApportioned).toString()).toBe("100");
    expect(c1.taxApportioned.plus(c2.taxApportioned).toString()).toBe("50");
  });

  it("includes a buy's own fee in the lot's cost per unit", () => {
    const buy = activity({
      id: "buy1",
      quantity: new Decimal(10),
      grossAmount: new Decimal(1000),
      feeAmount: new Decimal(20),
    });
    const sell = activity({
      id: "sell1",
      kind: "sell",
      tradeDate: "2025-09-01",
      quantity: new Decimal(10),
      grossAmount: new Decimal(1500),
    });
    const result = runFifoTaxLotEngine([buy, sell], false);
    // Cost per unit = (1000+20)/10 = 102; total cost consumed = 1020.
    const disposal = assertDefined(result.disposals[0]);
    const consumption = assertDefined(disposal.consumptions[0]);
    expect(consumption.acquisitionCostConsumed.toString()).toBe("1020");
  });
});

describe("runFifoTaxLotEngine — same-day ordering", () => {
  it("makes a same-day buy available to a same-day sell only when the buy was created first", () => {
    const buy = activity({
      id: "buy1",
      tradeDate: "2025-06-01",
      createdAt: "2025-06-01T09:00:00.000Z",
      quantity: new Decimal(5),
      grossAmount: new Decimal(500),
    });
    const sell = activity({
      id: "sell1",
      kind: "sell",
      tradeDate: "2025-06-01",
      createdAt: "2025-06-01T10:00:00.000Z",
      quantity: new Decimal(5),
      grossAmount: new Decimal(600),
    });
    const result = runFifoTaxLotEngine([sell, buy], false); // input order shouldn't matter
    const disposal = assertDefined(result.disposals[0]);
    expect(disposal.status).toBe("matched");
    expect(assertDefined(disposal.consumptions[0]).sourceActivityId).toBe(
      "buy1",
    );
  });

  it("leaves a same-day sell unmatched when it was created before the same-day buy", () => {
    const buy = activity({
      id: "buy1",
      tradeDate: "2025-06-01",
      createdAt: "2025-06-01T11:00:00.000Z",
      quantity: new Decimal(5),
      grossAmount: new Decimal(500),
    });
    const sell = activity({
      id: "sell1",
      kind: "sell",
      tradeDate: "2025-06-01",
      createdAt: "2025-06-01T09:00:00.000Z",
      quantity: new Decimal(5),
      grossAmount: new Decimal(600),
    });
    const result = runFifoTaxLotEngine([buy, sell], false);
    const disposal = assertDefined(result.disposals[0]);
    expect(disposal.status).toBe("needs_review");
    expect(disposal.quantityUnmatched.toString()).toBe("5");
  });
});

describe("runFifoTaxLotEngine — missing acquisition data / excess disposal", () => {
  it("marks a disposal needs_review, never fabricating a gain, when units exceed available lots", () => {
    const buy = activity({
      id: "buy1",
      quantity: new Decimal(5),
      grossAmount: new Decimal(500),
    });
    const sell = activity({
      id: "sell1",
      kind: "sell",
      tradeDate: "2025-09-01",
      quantity: new Decimal(8),
      grossAmount: new Decimal(1200),
    });

    const result = runFifoTaxLotEngine([buy, sell], false);
    expect(result.status).toBe("partial");
    const disposal = assertDefined(result.disposals[0]);
    expect(disposal.status).toBe("needs_review");
    expect(disposal.quantityMatched.toString()).toBe("5");
    expect(disposal.quantityUnmatched.toString()).toBe("3");
    // The matched portion still gets a real gain figure — only the unmatched 3 units are withheld.
    expect(disposal.consumptions).toHaveLength(1);
  });

  it("marks needs_review, not a fabricated zero-cost gain, when there is no purchase history at all", () => {
    const sell = activity({
      id: "sell1",
      kind: "sell",
      tradeDate: "2025-09-01",
      quantity: new Decimal(10),
      grossAmount: new Decimal(1000),
    });
    const result = runFifoTaxLotEngine([sell], false);
    const disposal = assertDefined(result.disposals[0]);
    expect(disposal.status).toBe("needs_review");
    expect(disposal.quantityMatched.toString()).toBe("0");
    expect(disposal.consumptions).toHaveLength(0);
  });
});

describe("runFifoTaxLotEngine — reversal handling", () => {
  it("excludes a reversed buy and its reversal row entirely, as if the purchase never happened", () => {
    const buy = activity({
      id: "buy1",
      quantity: new Decimal(10),
      grossAmount: new Decimal(1000),
      reversedBy: "rev1",
    });
    const reversal = activity({
      id: "rev1",
      quantity: new Decimal(-10),
      grossAmount: new Decimal(-1000),
      reversalOf: "buy1",
      tradeDate: "2025-06-02",
      createdAt: "2025-06-02T00:00:00.000Z",
    });
    const result = runFifoTaxLotEngine([buy, reversal], false);
    expect(result.remainingLots).toHaveLength(0);
    expect(result.disposals).toHaveLength(0);
  });

  it("excludes a reversed sell and its reversal row entirely, restoring the lot as untouched", () => {
    const buy = activity({
      id: "buy1",
      quantity: new Decimal(10),
      grossAmount: new Decimal(1000),
    });
    const sell = activity({
      id: "sell1",
      kind: "sell",
      tradeDate: "2025-07-01",
      createdAt: "2025-07-01T00:00:00.000Z",
      quantity: new Decimal(10),
      grossAmount: new Decimal(1500),
      reversedBy: "rev1",
    });
    const reversal = activity({
      id: "rev1",
      kind: "sell",
      quantity: new Decimal(-10),
      grossAmount: new Decimal(-1500),
      reversalOf: "sell1",
      tradeDate: "2025-07-02",
      createdAt: "2025-07-02T00:00:00.000Z",
    });
    const result = runFifoTaxLotEngine([buy, sell, reversal], false);
    expect(result.disposals).toHaveLength(0);
    expect(result.remainingLots).toHaveLength(1);
    expect(
      assertDefined(result.remainingLots[0]).remainingQuantity.toString(),
    ).toBe("10");
  });

  it("still processes an unaffected later sale after a reversed earlier purchase is excluded", () => {
    const reversedBuy = activity({
      id: "buy1",
      tradeDate: "2025-01-01",
      createdAt: "2025-01-01T00:00:00.000Z",
      quantity: new Decimal(5),
      grossAmount: new Decimal(400),
      reversedBy: "rev1",
    });
    const reversal = activity({
      id: "rev1",
      tradeDate: "2025-01-02",
      createdAt: "2025-01-02T00:00:00.000Z",
      quantity: new Decimal(-5),
      grossAmount: new Decimal(-400),
      reversalOf: "buy1",
    });
    const goodBuy = activity({
      id: "buy2",
      tradeDate: "2025-02-01",
      createdAt: "2025-02-01T00:00:00.000Z",
      quantity: new Decimal(5),
      grossAmount: new Decimal(500),
    });
    const sell = activity({
      id: "sell1",
      kind: "sell",
      tradeDate: "2025-09-01",
      quantity: new Decimal(5),
      grossAmount: new Decimal(700),
    });

    const result = runFifoTaxLotEngine(
      [reversedBuy, reversal, goodBuy, sell],
      false,
    );
    const disposal = assertDefined(result.disposals[0]);
    expect(disposal.status).toBe("matched");
    expect(assertDefined(disposal.consumptions[0]).sourceActivityId).toBe(
      "buy2",
    );
  });
});

describe("runFifoTaxLotEngine — unsupported adjustment", () => {
  it("marks the whole result partial when an unsupported adjustment is flagged, even with clean buy/sell history", () => {
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
    const result = runFifoTaxLotEngine([buy, sell], true);
    expect(result.unsupportedAdjustmentPresent).toBe(true);
    expect(result.status).toBe("partial");
  });
});

describe("runFifoTaxLotEngine — mixed currency", () => {
  it("marks the result partial and reports hasMixedCurrency when activities carry more than one currency", () => {
    const buy = activity({
      id: "buy1",
      currency: "INR",
      quantity: new Decimal(10),
      grossAmount: new Decimal(1000),
    });
    const sell = activity({
      id: "sell1",
      kind: "sell",
      tradeDate: "2025-09-01",
      currency: "USD",
      quantity: new Decimal(10),
      grossAmount: new Decimal(1500),
    });

    const result = runFifoTaxLotEngine([buy, sell], false);

    expect(result.hasMixedCurrency).toBe(true);
    expect(result.status).toBe("partial");
  });

  it("never runs lot matching across mismatched currencies — no disposal is produced at all", () => {
    const buy = activity({ id: "buy1", currency: "INR" });
    const sell = activity({
      id: "sell1",
      kind: "sell",
      tradeDate: "2025-09-01",
      currency: "USD",
    });

    const result = runFifoTaxLotEngine([buy, sell], false);

    expect(result.disposals).toHaveLength(0);
    expect(result.remainingLots).toHaveLength(0);
  });

  it("does not flag mixed currency when every effective activity shares one currency", () => {
    const buy = activity({ id: "buy1", currency: "INR" });
    const sell = activity({
      id: "sell1",
      kind: "sell",
      tradeDate: "2025-09-01",
      currency: "INR",
    });

    const result = runFifoTaxLotEngine([buy, sell], false);

    expect(result.hasMixedCurrency).toBe(false);
  });

  it("ignores a reversed pair's currency when checking for a mismatch, consistent with excluding reversed activities entirely", () => {
    const buy = activity({ id: "buy1", currency: "INR" });
    const reversedBuy = activity({
      id: "buy2",
      currency: "USD",
      reversedBy: "buy2-reversal",
    });
    const reversal = activity({
      id: "buy2-reversal",
      currency: "USD",
      reversalOf: "buy2",
    });
    const sell = activity({
      id: "sell1",
      kind: "sell",
      tradeDate: "2025-09-01",
      currency: "INR",
      quantity: new Decimal(10),
      grossAmount: new Decimal(1500),
    });

    const result = runFifoTaxLotEngine(
      [buy, reversedBuy, reversal, sell],
      false,
    );

    expect(result.hasMixedCurrency).toBe(false);
    expect(result.status).toBe("complete");
  });
});

describe("runFifoTaxLotEngine — exactness and reproducibility", () => {
  it("never produces NaN or Infinity across a varied activity stream", () => {
    const activities = [
      activity({
        id: "b1",
        tradeDate: "2025-01-01",
        createdAt: "2025-01-01T00:00:00.000Z",
        quantity: new Decimal("3.333333"),
        grossAmount: new Decimal("333.33"),
      }),
      activity({
        id: "b2",
        tradeDate: "2025-02-01",
        createdAt: "2025-02-01T00:00:00.000Z",
        quantity: new Decimal("6.666667"),
        grossAmount: new Decimal("777.77"),
        feeAmount: new Decimal("1.11"),
      }),
      activity({
        id: "s1",
        kind: "sell",
        tradeDate: "2025-09-01",
        quantity: new Decimal("7.5"),
        grossAmount: new Decimal("999.99"),
        feeAmount: new Decimal("2.22"),
        taxAmount: new Decimal("0.5"),
      }),
    ];
    const result = runFifoTaxLotEngine(activities, false);
    for (const disposal of result.disposals) {
      for (const c of disposal.consumptions) {
        expect(c.gainOrLoss.isFinite()).toBe(true);
        expect(c.acquisitionCostConsumed.isFinite()).toBe(true);
      }
    }
  });

  it("is fully reproducible — the same input always produces the same result", () => {
    const activities = [
      activity({
        id: "b1",
        quantity: new Decimal(10),
        grossAmount: new Decimal(1000),
      }),
      activity({
        id: "s1",
        kind: "sell",
        tradeDate: "2025-09-01",
        quantity: new Decimal(6),
        grossAmount: new Decimal(900),
      }),
    ];
    const first = runFifoTaxLotEngine(activities, false);
    const second = runFifoTaxLotEngine(activities, false);
    const firstGain = assertDefined(
      assertDefined(first.disposals[0]).consumptions[0],
    ).gainOrLoss.toString();
    const secondGain = assertDefined(
      assertDefined(second.disposals[0]).consumptions[0],
    ).gainOrLoss.toString();
    expect(firstGain).toBe(secondGain);
  });

  it("input order does not affect the result — activities are always sorted chronologically first", () => {
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
      tradeDate: "2025-09-01",
      quantity: new Decimal(10),
      grossAmount: new Decimal(1500),
    });
    const forward = runFifoTaxLotEngine([buy, sell], false);
    const reversed = runFifoTaxLotEngine([sell, buy], false);
    const forwardGain = assertDefined(
      assertDefined(forward.disposals[0]).consumptions[0],
    ).gainOrLoss.toString();
    const reversedGain = assertDefined(
      assertDefined(reversed.disposals[0]).consumptions[0],
    ).gainOrLoss.toString();
    expect(forwardGain).toBe(reversedGain);
  });
});
