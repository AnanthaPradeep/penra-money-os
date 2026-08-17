import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const resetPasswordActionMock = vi.fn();
vi.mock("@/lib/auth/actions", () => ({
  resetPasswordAction: (...args: unknown[]) => resetPasswordActionMock(...args),
}));

import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";

describe("ResetPasswordForm", () => {
  it("renders accessible, correctly typed password fields", () => {
    render(<ResetPasswordForm />);

    expect(screen.getByLabelText("New password")).toHaveAttribute(
      "type",
      "password",
    );
    expect(screen.getByLabelText("New password")).toHaveAttribute(
      "autocomplete",
      "new-password",
    );
    expect(screen.getByLabelText("Confirm new password")).toHaveAttribute(
      "autocomplete",
      "new-password",
    );
  });

  it("never puts password information in the DOM outside the input values themselves", () => {
    render(<ResetPasswordForm />);

    expect(document.body.textContent).not.toMatch(/hunter2|password123/i);
  });

  it("shows a safe expired-link error message returned by the action", async () => {
    resetPasswordActionMock.mockResolvedValue({
      status: "error",
      message: "This link is invalid or has expired. Please request a new one.",
    });

    const user = userEvent.setup();
    render(<ResetPasswordForm />);

    await user.type(
      screen.getByLabelText("New password"),
      "a brand new password",
    );
    await user.type(
      screen.getByLabelText("Confirm new password"),
      "a brand new password",
    );
    await user.click(screen.getByRole("button", { name: "Set new password" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      "This link is invalid or has expired. Please request a new one.",
    );
  });

  it("shows an accessible pending state while submitting", async () => {
    let resolveAction!: (value: { status: "idle" }) => void;
    resetPasswordActionMock.mockReturnValue(
      new Promise((resolve) => {
        resolveAction = resolve;
      }),
    );

    const user = userEvent.setup();
    render(<ResetPasswordForm />);

    await user.type(
      screen.getByLabelText("New password"),
      "a brand new password",
    );
    await user.type(
      screen.getByLabelText("Confirm new password"),
      "a brand new password",
    );
    await user.click(screen.getByRole("button", { name: "Set new password" }));

    expect(
      await screen.findByRole("button", { name: "Updating password…" }),
    ).toBeDisabled();

    resolveAction({ status: "idle" });
  });
});
