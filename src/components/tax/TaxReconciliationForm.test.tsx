import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { assertDefined } from "@/test/assert";
import type { saveTaxReconciliationItemAction } from "@/lib/tax/actions";

const saveTaxReconciliationItemActionMock =
  vi.fn<typeof saveTaxReconciliationItemAction>();
vi.mock("@/lib/tax/actions", () => ({
  saveTaxReconciliationItemAction: (
    ...args: Parameters<typeof saveTaxReconciliationItemAction>
  ) => saveTaxReconciliationItemActionMock(...args),
}));

import { TaxReconciliationForm } from "@/components/tax/TaxReconciliationForm";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("TaxReconciliationForm — sources", () => {
  it("offers AIS/TIS and Form 26AS as the two reconciliation sources", () => {
    render(<TaxReconciliationForm financialYearId="2025-26" />);
    expect(screen.getByRole("option", { name: "AIS/TIS" })).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "Form 26AS" }),
    ).toBeInTheDocument();
  });
});

describe("TaxReconciliationForm — statuses", () => {
  it("offers every reconciliation status the workspace supports", () => {
    render(<TaxReconciliationForm financialYearId="2025-26" />);
    for (const status of [
      "unreviewed",
      "matched",
      "difference",
      "missing in penra",
      "missing in statement",
      "user confirmed",
      "not applicable",
    ]) {
      expect(screen.getByRole("option", { name: status })).toBeInTheDocument();
    }
  });

  it("defaults to unreviewed for a new item", () => {
    render(<TaxReconciliationForm financialYearId="2025-26" />);
    expect(screen.getByLabelText("Status")).toHaveValue("unreviewed");
  });
});

describe("TaxReconciliationForm — reported vs PENRA-derived values", () => {
  it("keeps the reported-by-source figure and the PENRA-derived figure as two distinct fields", () => {
    render(<TaxReconciliationForm financialYearId="2025-26" />);
    expect(
      screen.getByLabelText("Reported by source (optional)"),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("PENRA-derived figure (optional)"),
    ).toBeInTheDocument();
  });

  it("submits a difference item with both a reported and a PENRA figure that disagree", async () => {
    saveTaxReconciliationItemActionMock.mockResolvedValue({
      status: "success",
      message: "Item saved.",
    });
    const user = userEvent.setup();
    render(<TaxReconciliationForm financialYearId="2025-26" />);

    await user.selectOptions(screen.getByLabelText("Source"), "Form 26AS");
    await user.type(screen.getByLabelText("Income category"), "salary_tds");
    await user.type(
      screen.getByLabelText("Reported by source (optional)"),
      "45000",
    );
    await user.type(
      screen.getByLabelText("PENRA-derived figure (optional)"),
      "44000",
    );
    await user.selectOptions(screen.getByLabelText("Status"), "difference");
    await user.type(
      screen.getByLabelText("Explanation (optional)"),
      "1000 gap under review",
    );
    await user.click(screen.getByRole("button", { name: "Save item" }));

    const [, formData] = assertDefined(
      saveTaxReconciliationItemActionMock.mock.calls[0],
    );
    expect(formData.get("reportedAmount")).toBe("45000");
    expect(formData.get("penraAmount")).toBe("44000");
    expect(formData.get("status")).toBe("difference");
    expect(formData.get("financialYearId")).toBe("2025-26");
  });

  it("shows a validation error tied to the offending field", async () => {
    saveTaxReconciliationItemActionMock.mockResolvedValue({
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: { incomeCategory: "Enter an income category." },
    });
    const user = userEvent.setup();
    render(<TaxReconciliationForm financialYearId="2025-26" />);

    await user.click(screen.getByRole("button", { name: "Save item" }));

    expect(
      await screen.findByText("Enter an income category."),
    ).toBeInTheDocument();
  });
});
