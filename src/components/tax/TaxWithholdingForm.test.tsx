import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { assertDefined } from "@/test/assert";
import type { saveTaxWithholdingAction } from "@/lib/tax/actions";

const saveTaxWithholdingActionMock = vi.fn<typeof saveTaxWithholdingAction>();
vi.mock("@/lib/tax/actions", () => ({
  saveTaxWithholdingAction: (
    ...args: Parameters<typeof saveTaxWithholdingAction>
  ) => saveTaxWithholdingActionMock(...args),
}));

import { TaxWithholdingForm } from "@/components/tax/TaxWithholdingForm";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("TaxWithholdingForm — TDS/TCS types", () => {
  it("offers salary, interest, dividend, other TDS, and TCS as choosable types", () => {
    render(<TaxWithholdingForm financialYearId="2025-26" />);

    for (const label of [
      "Salary TDS",
      "Interest TDS",
      "Dividend TDS",
      "Other TDS",
      "TCS",
    ]) {
      expect(screen.getByRole("option", { name: label })).toBeInTheDocument();
    }
  });

  it("keeps gross amount and tax withheld as two distinct fields, never combined", () => {
    render(<TaxWithholdingForm financialYearId="2025-26" />);

    expect(screen.getByLabelText("Gross amount")).toBeInTheDocument();
    expect(screen.getByLabelText("Tax withheld")).toBeInTheDocument();
  });

  it("submits a salary-TDS record with distinct gross/withheld amounts and a date", async () => {
    saveTaxWithholdingActionMock.mockResolvedValue({
      status: "success",
      message: "Record saved.",
    });
    const user = userEvent.setup();
    render(<TaxWithholdingForm financialYearId="2025-26" />);

    await user.selectOptions(screen.getByLabelText("Type"), "Salary TDS");
    await user.type(screen.getByLabelText("Deductor/source name"), "Acme Corp");
    await user.type(screen.getByLabelText("Gross amount"), "600000");
    await user.type(screen.getByLabelText("Tax withheld"), "45000");
    await user.type(screen.getByLabelText("Date"), "2025-06-01");
    await user.click(screen.getByRole("button", { name: "Add record" }));

    const [, formData] = assertDefined(
      saveTaxWithholdingActionMock.mock.calls[0],
    );
    expect(formData.get("withholdingType")).toBe("salary_tds");
    expect(formData.get("grossAmount")).toBe("600000");
    expect(formData.get("taxWithheld")).toBe("45000");
    expect(formData.get("financialYearId")).toBe("2025-26");
  });

  it("submits a dividend-TDS record distinctly from a salary-TDS record", async () => {
    saveTaxWithholdingActionMock.mockResolvedValue({
      status: "success",
      message: "Record saved.",
    });
    const user = userEvent.setup();
    render(<TaxWithholdingForm financialYearId="2025-26" />);

    await user.selectOptions(screen.getByLabelText("Type"), "Dividend TDS");
    await user.type(
      screen.getByLabelText("Deductor/source name"),
      "Example Corp",
    );
    await user.type(screen.getByLabelText("Gross amount"), "20000");
    await user.type(screen.getByLabelText("Tax withheld"), "2000");
    await user.type(screen.getByLabelText("Date"), "2025-09-01");
    await user.click(screen.getByRole("button", { name: "Add record" }));

    const [, formData] = assertDefined(
      saveTaxWithholdingActionMock.mock.calls[0],
    );
    expect(formData.get("withholdingType")).toBe("dividend_tds");
  });

  it("shows a validation error for an invalid date/amount, tied to the offending field", async () => {
    saveTaxWithholdingActionMock.mockResolvedValue({
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: { taxWithheld: "Enter a valid amount." },
    });
    const user = userEvent.setup();
    render(<TaxWithholdingForm financialYearId="2025-26" />);

    await user.click(screen.getByRole("button", { name: "Add record" }));

    expect(
      await screen.findByText("Enter a valid amount."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Tax withheld")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });

  it("shows an empty-form state with no pre-filled values", () => {
    render(<TaxWithholdingForm financialYearId="2025-26" />);
    expect(screen.getByLabelText("Deductor/source name")).toHaveValue("");
    expect(screen.getByLabelText("Gross amount")).toHaveValue("");
  });
});
