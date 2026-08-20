import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { HoldingRow } from "@/components/investments/HoldingRow";
import type { HoldingSummary } from "@/lib/investments/mapping";
import { Decimal } from "@/lib/money/decimal";

function holding(overrides: Partial<HoldingSummary>): HoldingSummary {
  return {
    holdingId: "holding-1",
    investmentAssetId: "asset-1",
    assetKind: "stock",
    displayName: "HDFC Bank Ltd",
    symbol: "HDFCBANK",
    currency: "INR",
    status: "active",
    quantity: new Decimal(10),
    avgUnitCost: new Decimal(100),
    costBasis: new Decimal(1000),
    hasValuation: false,
    latestValuation: null,
    latestValuationAt: null,
    currentValue: new Decimal(1000),
    unrealizedGain: null,
    realizedGain: new Decimal(0),
    incomeReceived: new Decimal(0),
    ...overrides,
  };
}

describe("HoldingRow", () => {
  it("links to the holding detail page", () => {
    render(<HoldingRow holding={holding({})} />);

    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "/app/investments/holding-1",
    );
  });

  it("shows 'No valuation' instead of a fabricated value when none exists", () => {
    render(<HoldingRow holding={holding({ hasValuation: false })} />);

    expect(screen.getByText("No valuation")).toBeInTheDocument();
    expect(screen.queryByText("₹1,000.00")).not.toBeInTheDocument();
  });

  it("shows the current value once a valuation exists", () => {
    render(
      <HoldingRow
        holding={holding({
          hasValuation: true,
          currentValue: new Decimal(1200),
        })}
      />,
    );

    expect(screen.getByText("₹1,200.00")).toBeInTheDocument();
    expect(screen.queryByText("No valuation")).not.toBeInTheDocument();
  });

  it("shows an archived badge for an archived holding", () => {
    render(<HoldingRow holding={holding({ status: "archived" })} />);

    expect(screen.getByText("Archived")).toBeInTheDocument();
  });

  it("shows the asset kind and symbol", () => {
    render(<HoldingRow holding={holding({})} />);

    expect(screen.getByText("Stock · HDFCBANK")).toBeInTheDocument();
  });
});
