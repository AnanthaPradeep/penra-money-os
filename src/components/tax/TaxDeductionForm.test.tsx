import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { assertDefined } from "@/test/assert";
import type { saveTaxDeductionAction } from "@/lib/tax/actions";

const saveTaxDeductionActionMock = vi.fn<typeof saveTaxDeductionAction>();
vi.mock("@/lib/tax/actions", () => ({
  saveTaxDeductionAction: (
    ...args: Parameters<typeof saveTaxDeductionAction>
  ) => saveTaxDeductionActionMock(...args),
}));

import { TaxDeductionForm } from "@/components/tax/TaxDeductionForm";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("TaxDeductionForm — creating a deduction", () => {
  it("renders the section, claimed-amount, and evidence fields, scoped to the given financial year", () => {
    render(<TaxDeductionForm financialYearId="2025-26" />);

    expect(screen.getByLabelText("Section")).toBeInTheDocument();
    expect(screen.getByLabelText("Claimed amount")).toBeInTheDocument();
    expect(screen.getByLabelText("Evidence (optional)")).toBeInTheDocument();
  });

  it("submits the section, claimed amount, evidence, and financial year through the action", async () => {
    saveTaxDeductionActionMock.mockResolvedValue({
      status: "success",
      message: "Deduction saved.",
    });
    const user = userEvent.setup();
    render(<TaxDeductionForm financialYearId="2025-26" />);

    await user.type(screen.getByLabelText("Section"), "80C");
    await user.type(screen.getByLabelText("Claimed amount"), "150000");
    await user.type(
      screen.getByLabelText("Evidence (optional)"),
      "PPF passbook",
    );
    await user.click(screen.getByRole("button", { name: "Add deduction" }));

    expect(saveTaxDeductionActionMock).toHaveBeenCalledTimes(1);
    const [, formData] = assertDefined(
      saveTaxDeductionActionMock.mock.calls[0],
    );
    expect(formData.get("financialYearId")).toBe("2025-26");
    expect(formData.get("section")).toBe("80C");
    expect(formData.get("claimedAmount")).toBe("150000");
    expect(formData.get("evidenceLabel")).toBe("PPF passbook");
  });

  it("shows a validation error for a missing required field, associated with the field", async () => {
    saveTaxDeductionActionMock.mockResolvedValue({
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: { claimedAmount: "Enter a claimed amount." },
    });
    const user = userEvent.setup();
    render(<TaxDeductionForm financialYearId="2025-26" />);

    await user.click(screen.getByRole("button", { name: "Add deduction" }));

    expect(
      await screen.findByText("Enter a claimed amount."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Claimed amount")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });

  it("shows the generic Server Action error message", async () => {
    saveTaxDeductionActionMock.mockResolvedValue({
      status: "error",
      message: "Something went wrong. Please try again.",
    });
    const user = userEvent.setup();
    render(<TaxDeductionForm financialYearId="2025-26" />);

    await user.click(screen.getByRole("button", { name: "Add deduction" }));

    expect(
      await screen.findByText("Something went wrong. Please try again."),
    ).toBeInTheDocument();
  });
});
