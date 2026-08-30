import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { saveTaxProfileAction } from "@/lib/tax/actions";
import type { TaxProfile } from "@/lib/tax/mapping";

const saveTaxProfileActionMock = vi.fn<typeof saveTaxProfileAction>();
vi.mock("@/lib/tax/actions", () => ({
  saveTaxProfileAction: (...args: Parameters<typeof saveTaxProfileAction>) =>
    saveTaxProfileActionMock(...args),
}));

import { TaxProfileForm } from "@/components/tax/TaxProfileForm";

beforeEach(() => {
  vi.clearAllMocks();
});

const EXISTING_PROFILE: TaxProfile = {
  id: "profile-1",
  taxpayerType: "individual",
  residentialStatus: "resident",
  hasBusinessOrProfessionalIncome: false,
  hasSalaryOrPensionIncome: true,
  defaultRegimePreference: "new",
  ageBand: "below_60",
  maskedPanLabel: "1234",
  notes: "Salaried, one FD.",
  updatedAt: "2026-06-01T00:00:00.000Z",
};

describe("TaxProfileForm — empty-profile state", () => {
  it("shows the residential-status field defaulted to resident with no profile yet", () => {
    render(<TaxProfileForm profile={null} />);
    expect(screen.getByLabelText("Residential status")).toHaveValue("resident");
    expect(
      screen.getByLabelText(/I have salary or pension income/),
    ).toBeChecked();
    expect(screen.getByLabelText("Last 4 characters of your PAN")).toHaveValue(
      "",
    );
  });

  it("submits a new profile as a supported resident individual", async () => {
    saveTaxProfileActionMock.mockResolvedValue({
      status: "success",
      message: "Tax profile saved.",
    });
    const user = userEvent.setup();
    render(<TaxProfileForm profile={null} />);

    await user.click(screen.getByRole("button", { name: "Save profile" }));

    expect(saveTaxProfileActionMock).toHaveBeenCalledTimes(1);
  });
});

describe("TaxProfileForm — editing an existing profile", () => {
  it("pre-fills every field from the existing profile", () => {
    render(<TaxProfileForm profile={EXISTING_PROFILE} />);

    expect(screen.getByLabelText("Residential status")).toHaveValue("resident");
    expect(screen.getByLabelText("Age band (optional)")).toHaveValue(
      "below_60",
    );
    expect(
      screen.getByLabelText("Default regime for viewing (optional)"),
    ).toHaveValue("new");
    expect(screen.getByLabelText("Last 4 characters of your PAN")).toHaveValue(
      "1234",
    );
    expect(screen.getByDisplayValue("Salaried, one FD.")).toBeInTheDocument();
  });

  it("changes the default-regime-for-viewing preference without recommending a regime", async () => {
    const user = userEvent.setup();
    render(<TaxProfileForm profile={EXISTING_PROFILE} />);

    await user.selectOptions(
      screen.getByLabelText("Default regime for viewing (optional)"),
      "Old regime",
    );

    expect(
      screen.getByLabelText("Default regime for viewing (optional)"),
    ).toHaveValue("old");
    expect(
      screen.getByText(/PENRA never chooses a regime for you/),
    ).toBeInTheDocument();
  });
});

describe("TaxProfileForm — validation", () => {
  it("shows a field-level error message associated with the field via aria-describedby", async () => {
    saveTaxProfileActionMock.mockResolvedValue({
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: {
        maskedPanLabel: "Enter up to 4 letters/digits only.",
      },
    });
    const user = userEvent.setup();
    render(<TaxProfileForm profile={null} />);

    await user.click(screen.getByRole("button", { name: "Save profile" }));

    const field = await screen.findByLabelText("Last 4 characters of your PAN");
    const errorNode = await screen.findByText(
      "Enter up to 4 letters/digits only.",
    );
    const describedBy = field.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    expect(describedBy).toContain(errorNode.id);
    expect(field).toHaveAttribute("aria-invalid", "true");
  });

  it("shows the generic error message alongside field errors", async () => {
    saveTaxProfileActionMock.mockResolvedValue({
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: { residentialStatus: "Choose a residential status." },
    });
    const user = userEvent.setup();
    render(<TaxProfileForm profile={null} />);

    await user.click(screen.getByRole("button", { name: "Save profile" }));

    expect(
      await screen.findByText("Please fix the highlighted fields."),
    ).toBeInTheDocument();
  });

  it("preserves already-entered values after a validation failure — the PAN field keeps its typed value", async () => {
    saveTaxProfileActionMock.mockResolvedValue({
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: { maskedPanLabel: "Enter up to 4 letters/digits only." },
    });
    const user = userEvent.setup();
    render(<TaxProfileForm profile={null} />);

    const panField = screen.getByLabelText("Last 4 characters of your PAN");
    await user.type(panField, "9Z9Z");
    await user.click(screen.getByRole("button", { name: "Save profile" }));

    await screen.findByText("Enter up to 4 letters/digits only.");
    expect(panField).toHaveValue("9Z9Z");
  });

  it("shows a successful save confirmation", async () => {
    saveTaxProfileActionMock.mockResolvedValue({
      status: "success",
      message: "Tax profile saved.",
    });
    const user = userEvent.setup();
    render(<TaxProfileForm profile={null} />);

    await user.click(screen.getByRole("button", { name: "Save profile" }));

    expect(await screen.findByText("Tax profile saved.")).toBeInTheDocument();
  });
});

describe("TaxProfileForm — unsupported-scope warnings", () => {
  it("offers non-resident and RNOR as choosable options, each labelled unsupported for automated estimates", () => {
    render(<TaxProfileForm profile={null} />);

    expect(
      screen.getByRole("option", {
        name: "Non-resident (NRI) — unsupported for automated estimates",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", {
        name: "Resident but not ordinarily resident (RNOR) — unsupported for automated estimates",
      }),
    ).toBeInTheDocument();
  });

  it("lets the user select a business/professional-income checkbox that the scope check reads", async () => {
    const user = userEvent.setup();
    render(<TaxProfileForm profile={null} />);

    const checkbox = screen.getByLabelText(
      "I have business or professional income",
    );
    expect(checkbox).not.toBeChecked();
    await user.click(checkbox);
    expect(checkbox).toBeChecked();
  });

  it("labels senior and super-senior age bands as unsupported for automated slabs", () => {
    render(<TaxProfileForm profile={null} />);

    expect(
      screen.getByRole("option", {
        name: "60 to 80 (senior citizen slabs unsupported)",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", {
        name: "Above 80 (super senior slabs unsupported)",
      }),
    ).toBeInTheDocument();
  });
});
