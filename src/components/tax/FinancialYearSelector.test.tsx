import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

import { FinancialYearSelector } from "@/components/tax/FinancialYearSelector";

function setPath(pathname: string) {
  window.history.pushState({}, "", pathname);
}

describe("FinancialYearSelector", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    setPath("/");
  });

  it("shows the current financial year as the selected option", () => {
    setPath("/app/tax/2025-26");
    render(
      <FinancialYearSelector
        financialYearId="2025-26"
        options={["2025-26", "2024-25", "2023-24"]}
      />,
    );

    expect(screen.getByLabelText("Financial year")).toHaveValue("2025-26");
  });

  it("lists every option passed in, labelled with the FY prefix", () => {
    setPath("/app/tax/2025-26");
    render(
      <FinancialYearSelector
        financialYearId="2025-26"
        options={["2025-26", "2024-25"]}
      />,
    );

    expect(
      screen.getByRole("option", { name: "FY 2025-26" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "FY 2024-25" }),
    ).toBeInTheDocument();
  });

  it("navigates to the equivalent sub-route for a historical FY, preserving the current sub-page", async () => {
    setPath("/app/tax/2025-26/income");
    const user = userEvent.setup();
    render(
      <FinancialYearSelector
        financialYearId="2025-26"
        options={["2025-26", "2024-25"]}
      />,
    );

    await user.selectOptions(
      screen.getByLabelText("Financial year"),
      "FY 2024-25",
    );

    expect(pushMock).toHaveBeenCalledWith("/app/tax/2024-25/income");
  });

  it("navigates to the workspace root for the new FY when there is no sub-page suffix", async () => {
    setPath("/app/tax/2025-26");
    const user = userEvent.setup();
    render(
      <FinancialYearSelector
        financialYearId="2025-26"
        options={["2025-26", "2024-25"]}
      />,
    );

    await user.selectOptions(
      screen.getByLabelText("Financial year"),
      "FY 2024-25",
    );

    expect(pushMock).toHaveBeenCalledWith("/app/tax/2024-25");
  });

  it("respects a custom basePath when building the destination route", async () => {
    setPath("/app/tax/2025-26/capital-gains");
    const user = userEvent.setup();
    render(
      <FinancialYearSelector
        financialYearId="2025-26"
        options={["2025-26", "2024-25"]}
        basePath="/app/tax"
      />,
    );

    await user.selectOptions(
      screen.getByLabelText("Financial year"),
      "FY 2024-25",
    );

    expect(pushMock).toHaveBeenCalledWith("/app/tax/2024-25/capital-gains");
  });

  it("shows no options and no selection when the caller supplies an empty option list (empty state)", () => {
    setPath("/app/tax/2025-26");
    render(<FinancialYearSelector financialYearId="2025-26" options={[]} />);

    const select = screen.getByLabelText("Financial year");
    expect(select.querySelectorAll("option")).toHaveLength(0);
  });

  it("is a native select — usable with keyboard/touch on a mobile viewport without any pointer-only interaction", async () => {
    setPath("/app/tax/2025-26");
    const user = userEvent.setup();
    render(
      <FinancialYearSelector
        financialYearId="2025-26"
        options={["2025-26", "2024-25"]}
      />,
    );

    const select = screen.getByLabelText("Financial year");
    select.focus();
    expect(select).toHaveFocus();
    await user.selectOptions(select, "FY 2024-25");
    expect(pushMock).toHaveBeenCalledTimes(1);
  });
});
