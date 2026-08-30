import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { assertDefined } from "@/test/assert";
import type { saveTaxPaymentAction } from "@/lib/tax/actions";

const saveTaxPaymentActionMock = vi.fn<typeof saveTaxPaymentAction>();
vi.mock("@/lib/tax/actions", () => ({
  saveTaxPaymentAction: (...args: Parameters<typeof saveTaxPaymentAction>) =>
    saveTaxPaymentActionMock(...args),
}));

import { TaxPaymentForm } from "@/components/tax/TaxPaymentForm";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("TaxPaymentForm — payment types", () => {
  it("offers advance tax, self-assessment tax, and refund as choosable types", () => {
    render(<TaxPaymentForm financialYearId="2025-26" />);

    for (const label of [
      "Advance tax",
      "Self-assessment tax",
      "Refund received",
    ]) {
      expect(screen.getByRole("option", { name: label })).toBeInTheDocument();
    }
  });

  it("submits an advance-tax payment with amount, date, and financial year", async () => {
    saveTaxPaymentActionMock.mockResolvedValue({
      status: "success",
      message: "Payment recorded.",
    });
    const user = userEvent.setup();
    render(<TaxPaymentForm financialYearId="2025-26" />);

    await user.selectOptions(screen.getByLabelText("Type"), "Advance tax");
    await user.type(screen.getByLabelText("Amount"), "25000");
    await user.type(screen.getByLabelText("Date"), "2025-06-15");
    await user.click(screen.getByRole("button", { name: "Record payment" }));

    const [, formData] = assertDefined(saveTaxPaymentActionMock.mock.calls[0]);
    expect(formData.get("paymentType")).toBe("advance_tax");
    expect(formData.get("amount")).toBe("25000");
    expect(formData.get("financialYearId")).toBe("2025-26");
  });

  it("submits a refund distinctly from a self-assessment-tax payment", async () => {
    saveTaxPaymentActionMock.mockResolvedValue({
      status: "success",
      message: "Payment recorded.",
    });
    const user = userEvent.setup();
    render(<TaxPaymentForm financialYearId="2025-26" />);

    await user.selectOptions(screen.getByLabelText("Type"), "Refund received");
    await user.type(screen.getByLabelText("Amount"), "3000");
    await user.type(screen.getByLabelText("Date"), "2025-12-01");
    await user.click(screen.getByRole("button", { name: "Record payment" }));

    const [, formData] = assertDefined(saveTaxPaymentActionMock.mock.calls[0]);
    expect(formData.get("paymentType")).toBe("refund");
  });

  it("shows a validation error for an invalid amount/date/reference", async () => {
    saveTaxPaymentActionMock.mockResolvedValue({
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: { amount: "Enter a valid amount." },
    });
    const user = userEvent.setup();
    render(<TaxPaymentForm financialYearId="2025-26" />);

    await user.click(screen.getByRole("button", { name: "Record payment" }));

    expect(
      await screen.findByText("Enter a valid amount."),
    ).toBeInTheDocument();
  });

  it("shows an empty state before any values are entered", () => {
    render(<TaxPaymentForm financialYearId="2025-26" />);
    expect(screen.getByLabelText("Amount")).toHaveValue("");
    expect(screen.getByLabelText("Challan reference (optional)")).toHaveValue(
      "",
    );
  });
});
