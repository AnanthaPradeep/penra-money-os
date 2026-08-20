import { describe, expect, it } from "vitest";

import {
  mapHoldingSummaryRow,
  mapMaturityEventRow,
} from "@/lib/investments/mapping";

describe("mapHoldingSummaryRow", () => {
  const BASE = {
    holding_id: "holding-1",
    investment_asset_id: "asset-1",
    asset_kind: "stock",
    display_name: "Test Stock",
    symbol: "TEST",
    currency: "INR",
    status: "active",
    quantity: 10,
    avg_unit_cost: 100,
    cost_basis: 1000,
    has_valuation: false,
    latest_valuation: null,
    latest_valuation_at: null,
    current_value: 1000,
    unrealized_gain: null,
    realized_gain: 0,
    income_received: 0,
  };

  it("reports has_valuation false and unrealized_gain null when no valuation exists (never a fabricated zero)", () => {
    const result = mapHoldingSummaryRow(BASE);
    expect(result.hasValuation).toBe(false);
    expect(result.unrealizedGain).toBeNull();
    expect(result.latestValuation).toBeNull();
    expect(result.currentValue.toString()).toBe("1000");
  });

  it("maps a valued holding with a nonzero unrealized gain", () => {
    const result = mapHoldingSummaryRow({
      ...BASE,
      has_valuation: true,
      latest_valuation: 1200,
      latest_valuation_at: "2026-08-01T00:00:00Z",
      current_value: 1200,
      unrealized_gain: 200,
    });
    expect(result.hasValuation).toBe(true);
    expect(result.unrealizedGain?.toString()).toBe("200");
    expect(result.latestValuation?.toString()).toBe("1200");
  });

  it("maps a zero-quantity, zero-cost-basis fully-disposed holding", () => {
    const result = mapHoldingSummaryRow({
      ...BASE,
      quantity: 0,
      avg_unit_cost: null,
      cost_basis: 0,
      current_value: 0,
    });
    expect(result.quantity.toString()).toBe("0");
    expect(result.avgUnitCost).toBeNull();
    expect(result.costBasis.toString()).toBe("0");
  });
});

describe("mapMaturityEventRow", () => {
  it("returns null when maturity_date is missing (should never happen for a row this function returns, defended anyway)", () => {
    const result = mapMaturityEventRow({
      holding_id: "holding-1",
      display_name: "Test FD",
      kind: "fixed_deposit",
      maturity_date: null,
      expected_maturity_amount: 100000,
    });
    expect(result).toBeNull();
  });

  it("maps a real maturity event with an expected amount", () => {
    const result = mapMaturityEventRow({
      holding_id: "holding-1",
      display_name: "Test FD",
      kind: "fixed_deposit",
      maturity_date: "2027-01-01",
      expected_maturity_amount: 107500,
    });
    expect(result?.maturityDate).toBe("2027-01-01");
    expect(result?.expectedMaturityAmount?.toString()).toBe("107500");
  });

  it("maps a maturity event with no expected amount as null, not zero", () => {
    const result = mapMaturityEventRow({
      holding_id: "holding-1",
      display_name: "Test PPF",
      kind: "ppf",
      maturity_date: "2040-01-01",
      expected_maturity_amount: null,
    });
    expect(result?.expectedMaturityAmount).toBeNull();
  });
});
