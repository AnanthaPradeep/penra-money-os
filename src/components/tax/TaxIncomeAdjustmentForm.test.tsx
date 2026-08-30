import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { assertDefined } from "@/test/assert";
import type { saveTaxIncomeAdjustmentAction } from "@/lib/tax/actions";

const saveTaxIncomeAdjustmentActionMock =
  vi.fn<typeof saveTaxIncomeAdjustmentAction>();
vi.mock("@/lib/tax/actions", () => ({
  saveTaxIncomeAdjustmentAction: (
    ...args: Parameters<typeof saveTaxIncomeAdjustmentAction>
  ) => saveTaxIncomeAdjustmentActionMock(...args),
}));

import { TaxIncomeAdjustmentForm } from "@/components/tax/TaxIncomeAdjustmentForm";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("TaxIncomeAdjustmentForm — categories", () => {
  it("offers every income category, including PPF interest and dividend", () => {
    render(<TaxIncomeAdjustmentForm financialYearId="2025-26" />);
    for (const label of [
      "Salary/pension",
      "Savings account interest",
      "Fixed deposit interest",
      "Recurring deposit interest",
      "PPF interest",
      "Dividend",
      "Income-tax refund interest",
      "Other taxable interest",
      "Other income",
    ]) {
      expect(screen.getByRole("option", { name: label })).toBeInTheDocument();
    }
  });
});

describe("TaxIncomeAdjustmentForm — gross/TDS distinctness", () => {
  it("keeps gross amount and TDS as two separate optional/required fields", () => {
    render(<TaxIncomeAdjustmentForm financialYearId="2025-26" />);
    expect(screen.getByLabelText("Gross amount")).toBeInTheDocument();
    expect(
      screen.getByLabelText("TDS deducted (optional)"),
    ).toBeInTheDocument();
  });

  it("submits gross, TDS, category, exempt-candidate flag, and financial year distinctly", async () => {
    saveTaxIncomeAdjustmentActionMock.mockResolvedValue({
      status: "success",
      message: "Income item saved.",
    });
    const user = userEvent.setup();
    render(<TaxIncomeAdjustmentForm financialYearId="2025-26" />);

    await user.selectOptions(screen.getByLabelText("Category"), "PPF interest");
    await user.type(screen.getByLabelText("Gross amount"), "5000");
    await user.click(
      screen.getByLabelText(
        "Treat as an exempt-income candidate (e.g. PPF interest)",
      ),
    );
    await user.click(screen.getByRole("button", { name: "Add income item" }));

    const [, formData] = assertDefined(
      saveTaxIncomeAdjustmentActionMock.mock.calls[0],
    );
    expect(formData.get("category")).toBe("ppf_interest");
    expect(formData.get("grossAmount")).toBe("5000");
    expect(formData.get("isExemptCandidate")).toBe("true");
    expect(formData.get("financialYearId")).toBe("2025-26");
    expect(formData.get("sourceType")).toBe("manual");
  });

  it("does not mark a plain interest item as an exempt candidate unless the checkbox is explicitly checked", async () => {
    saveTaxIncomeAdjustmentActionMock.mockResolvedValue({
      status: "success",
      message: "Income item saved.",
    });
    const user = userEvent.setup();
    render(<TaxIncomeAdjustmentForm financialYearId="2025-26" />);

    await user.selectOptions(
      screen.getByLabelText("Category"),
      "Savings account interest",
    );
    await user.type(screen.getByLabelText("Gross amount"), "100");
    await user.click(screen.getByRole("button", { name: "Add income item" }));

    const [, formData] = assertDefined(
      saveTaxIncomeAdjustmentActionMock.mock.calls[0],
    );
    expect(formData.get("isExemptCandidate")).toBeNull();
  });
});

describe("TaxIncomeAdjustmentForm — validation", () => {
  it("shows a validation error tied to the offending field", async () => {
    saveTaxIncomeAdjustmentActionMock.mockResolvedValue({
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: { grossAmount: "Enter a gross amount." },
    });
    const user = userEvent.setup();
    render(<TaxIncomeAdjustmentForm financialYearId="2025-26" />);

    await user.click(screen.getByRole("button", { name: "Add income item" }));

    expect(
      await screen.findByText("Enter a gross amount."),
    ).toBeInTheDocument();
  });
});
