import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { updateProfileAction } from "@/lib/profile/actions";

const updateProfileActionMock = vi.fn<typeof updateProfileAction>();
vi.mock("@/lib/profile/actions", () => ({
  INITIAL_PROFILE_ACTION_STATE: { status: "idle" },
  updateProfileAction: (...args: Parameters<typeof updateProfileAction>) =>
    updateProfileActionMock(...args),
}));

import { ProfileForm } from "@/components/profile/ProfileForm";
import { Toaster } from "@/components/ui/Toaster";

const SAMPLE_PROFILE = {
  id: "user-1",
  display_name: "Asha Rao",
  base_currency: "INR",
  locale: "en-IN",
  timezone: "Asia/Kolkata",
  financial_year_start_month: 4,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

describe("ProfileForm", () => {
  it("displays the profile's current values", () => {
    render(<ProfileForm profile={SAMPLE_PROFILE} />);

    expect(screen.getByLabelText("Name")).toHaveValue("Asha Rao");
    expect(screen.getByLabelText("Base currency")).toHaveValue("INR");
    expect(screen.getByLabelText("Locale")).toHaveValue("en-IN");
    expect(screen.getByLabelText("Timezone")).toHaveValue("Asia/Kolkata");
    expect(screen.getByLabelText("Financial year starts")).toHaveValue("April");
  });

  it("only the name field is editable in this personal version", () => {
    render(<ProfileForm profile={SAMPLE_PROFILE} />);

    expect(screen.getByLabelText("Name")).not.toBeDisabled();
    expect(screen.getByLabelText("Base currency")).toBeDisabled();
    expect(screen.getByLabelText("Locale")).toBeDisabled();
    expect(screen.getByLabelText("Timezone")).toBeDisabled();
    expect(screen.getByLabelText("Financial year starts")).toBeDisabled();
  });

  it("shows the correct month name for a non-April financial-year start", () => {
    render(
      <ProfileForm
        profile={{ ...SAMPLE_PROFILE, financial_year_start_month: 1 }}
      />,
    );

    expect(screen.getByLabelText("Financial year starts")).toHaveValue(
      "January",
    );
  });

  it("uses the name autocomplete value for the display name field", () => {
    render(<ProfileForm profile={SAMPLE_PROFILE} />);

    expect(screen.getByLabelText("Name")).toHaveAttribute(
      "autocomplete",
      "name",
    );
  });

  it("shows a success toast after a successful update", async () => {
    updateProfileActionMock.mockResolvedValue({
      status: "success",
      message: "Profile updated.",
    });

    const user = userEvent.setup();
    render(
      <>
        <ProfileForm profile={SAMPLE_PROFILE} />
        <Toaster />
      </>,
    );

    await user.clear(screen.getByLabelText("Name"));
    await user.type(screen.getByLabelText("Name"), "New Name");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByText("Profile updated.")).toBeInTheDocument();
  });

  it("shows a safe error message on failure, never a raw database error", async () => {
    updateProfileActionMock.mockResolvedValue({
      status: "error",
      message: "We couldn't update your profile. Please try again.",
    });

    const user = userEvent.setup();
    render(<ProfileForm profile={SAMPLE_PROFILE} />);

    await user.click(screen.getByRole("button", { name: "Save changes" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      "We couldn't update your profile. Please try again.",
    );
    expect(alert.textContent).not.toMatch(/row-level security|postgres|sql/i);
  });

  it("shows an accessible pending state while saving", async () => {
    let resolveAction!: (value: { status: "idle" }) => void;
    updateProfileActionMock.mockReturnValue(
      new Promise((resolve) => {
        resolveAction = resolve;
      }),
    );

    const user = userEvent.setup();
    render(<ProfileForm profile={SAMPLE_PROFILE} />);

    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(
      await screen.findByRole("button", { name: "Saving…" }),
    ).toBeDisabled();

    resolveAction({ status: "idle" });
  });
});
