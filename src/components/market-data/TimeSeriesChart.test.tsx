import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TimeSeriesChart } from "@/components/market-data/TimeSeriesChart";
import { Decimal } from "@/lib/money/decimal";

describe("TimeSeriesChart", () => {
  it("shows an honest empty state instead of a fabricated chart when there is no data", () => {
    render(<TimeSeriesChart points={[]} title="NAV" />);

    expect(
      screen.getByText("No nav history recorded yet."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("renders a single point without drawing a fabricated line", () => {
    render(
      <TimeSeriesChart
        points={[{ date: "2026-08-01", value: new Decimal(100) }]}
        title="NAV"
      />,
    );

    const svg = screen.getByRole("img", { hidden: true });
    expect(svg.querySelector("path")).not.toBeInTheDocument();
    expect(svg.querySelectorAll("circle")).toHaveLength(1);
  });

  it("renders a line and one point per observation for a multi-point series", () => {
    render(
      <TimeSeriesChart
        points={[
          { date: "2026-08-01", value: new Decimal(100) },
          { date: "2026-08-02", value: new Decimal(110) },
          { date: "2026-08-05", value: new Decimal(105) },
        ]}
        title="NAV"
      />,
    );

    const svg = screen.getByRole("img", { hidden: true });
    expect(svg.querySelector("path")).toBeInTheDocument();
    expect(svg.querySelectorAll("circle")).toHaveLength(3);
  });

  it("exposes every observation in an accessible data table, including the exact dates", () => {
    render(
      <TimeSeriesChart
        points={[
          { date: "2026-08-01", value: new Decimal(100) },
          { date: "2026-08-05", value: new Decimal(105) },
        ]}
        title="NAV"
      />,
    );

    const table = screen.getByRole("table");
    const rows = table.querySelectorAll("tbody tr");
    expect(rows).toHaveLength(2);
    expect(screen.getByText("100")).toBeInTheDocument();
    expect(screen.getByText("105")).toBeInTheDocument();
  });

  it("summarizes the series range in an accessible description", () => {
    render(
      <TimeSeriesChart
        points={[
          { date: "2026-08-01", value: new Decimal(100) },
          { date: "2026-08-05", value: new Decimal(105) },
        ]}
        title="Portfolio value"
      />,
    );

    expect(
      screen.getAllByText(
        /Portfolio value from 1 Aug 2026 \(100\) to 5 Aug 2026 \(105\), 2 observations\./,
      ).length,
    ).toBeGreaterThan(0);
  });

  it("applies a custom value formatter to both the chart summary and the table", () => {
    render(
      <TimeSeriesChart
        points={[{ date: "2026-08-01", value: new Decimal(100) }]}
        title="Portfolio value"
        formatValue={(v) => `₹${v.toString()}`}
      />,
    );

    expect(screen.getAllByText("₹100").length).toBeGreaterThan(0);
  });
});
