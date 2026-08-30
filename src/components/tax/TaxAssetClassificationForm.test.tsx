import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { assertDefined } from "@/test/assert";
import type { saveTaxAssetClassificationAction } from "@/lib/tax/actions";

const saveTaxAssetClassificationActionMock =
  vi.fn<typeof saveTaxAssetClassificationAction>();
vi.mock("@/lib/tax/actions", () => ({
  saveTaxAssetClassificationAction: (
    ...args: Parameters<typeof saveTaxAssetClassificationAction>
  ) => saveTaxAssetClassificationActionMock(...args),
}));

import { TaxAssetClassificationForm } from "@/components/tax/TaxAssetClassificationForm";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("TaxAssetClassificationForm — an unclassified asset", () => {
  it("shows the holding's display name and defaults to listed equity, never pre-selecting unsupported", () => {
    render(
      <TaxAssetClassificationForm
        investmentAssetId="asset-1"
        displayName="Mystery Fund"
      />,
    );
    expect(screen.getByText("Mystery Fund")).toBeInTheDocument();
    expect(screen.getByLabelText("Tax classification")).toHaveValue(
      "listed_equity",
    );
    expect(
      screen.queryByLabelText("Why is this unsupported?"),
    ).not.toBeInTheDocument();
  });

  it("requires a reason once 'unsupported' is chosen, never leaving it silently blank", async () => {
    const user = userEvent.setup();
    render(
      <TaxAssetClassificationForm
        investmentAssetId="asset-1"
        displayName="Mystery Fund"
      />,
    );

    await user.selectOptions(
      screen.getByLabelText("Tax classification"),
      "Unsupported for automated capital gains",
    );

    expect(screen.getByLabelText("Why is this unsupported?")).toBeRequired();
  });

  it("submits a listed-equity classification for the exact investment asset id", async () => {
    saveTaxAssetClassificationActionMock.mockResolvedValue({
      status: "success",
      message: "Classification saved.",
    });
    const user = userEvent.setup();
    render(
      <TaxAssetClassificationForm
        investmentAssetId="asset-42"
        displayName="Example Corp"
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Save classification" }),
    );

    const [, formData] = assertDefined(
      saveTaxAssetClassificationActionMock.mock.calls[0],
    );
    expect(formData.get("investmentAssetId")).toBe("asset-42");
    expect(formData.get("assetClass")).toBe("listed_equity");
  });

  it("submits an unsupported classification together with its reason", async () => {
    saveTaxAssetClassificationActionMock.mockResolvedValue({
      status: "success",
      message: "Classification saved.",
    });
    const user = userEvent.setup();
    render(
      <TaxAssetClassificationForm
        investmentAssetId="asset-99"
        displayName="Debt Fund"
      />,
    );

    await user.selectOptions(
      screen.getByLabelText("Tax classification"),
      "Unsupported for automated capital gains",
    );
    await user.type(
      screen.getByLabelText("Why is this unsupported?"),
      "debt mutual fund",
    );
    await user.click(
      screen.getByRole("button", { name: "Save classification" }),
    );

    const [, formData] = assertDefined(
      saveTaxAssetClassificationActionMock.mock.calls[0],
    );
    expect(formData.get("assetClass")).toBe("unsupported");
    expect(formData.get("unsupportedReason")).toBe("debt mutual fund");
  });

  it("shows a validation error tied to the offending field", async () => {
    saveTaxAssetClassificationActionMock.mockResolvedValue({
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: { assetClass: "Choose a classification." },
    });
    const user = userEvent.setup();
    render(
      <TaxAssetClassificationForm
        investmentAssetId="asset-1"
        displayName="Mystery Fund"
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Save classification" }),
    );

    expect(
      await screen.findByText("Choose a classification."),
    ).toBeInTheDocument();
  });
});
