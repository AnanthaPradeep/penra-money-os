import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { forgotPasswordAction } from "@/lib/auth/actions";

const forgotPasswordActionMock = vi.fn<typeof forgotPasswordAction>();
vi.mock("@/lib/auth/actions", () => ({
  forgotPasswordAction: (...args: Parameters<typeof forgotPasswordAction>) =>
    forgotPasswordActionMock(...args),
}));

import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";

describe("ForgotPasswordForm", () => {
  it("renders an accessible, correctly typed email field", () => {
    render(<ForgotPasswordForm />);

    expect(screen.getByLabelText("Email")).toHaveAttribute("type", "email");
    expect(screen.getByLabelText("Email")).toHaveAttribute(
      "autocomplete",
      "email",
    );
  });

  it("shows the privacy-preserving success message after submitting", async () => {
    forgotPasswordActionMock.mockResolvedValue({
      status: "success",
      message:
        "If an account exists for that email, password reset instructions will be sent.",
    });

    const user = userEvent.setup();
    render(<ForgotPasswordForm />);

    await user.type(screen.getByLabelText("Email"), "asha@example.com");
    await user.click(
      screen.getByRole("button", { name: "Send reset instructions" }),
    );

    const status = await screen.findByRole("status");
    expect(status).toHaveTextContent(
      "If an account exists for that email, password reset instructions will be sent.",
    );
  });

  it("never reveals whether the email exists, even for a non-existent account", async () => {
    // From the form's point of view, a "does not exist" outcome and a
    // "does exist" outcome are the exact same success-shaped state — the
    // Server Action guarantees this (see actions.test.ts); this test
    // confirms the form has no separate rendering path that could leak it.
    forgotPasswordActionMock.mockResolvedValue({
      status: "success",
      message:
        "If an account exists for that email, password reset instructions will be sent.",
    });

    const user = userEvent.setup();
    render(<ForgotPasswordForm />);

    await user.type(
      screen.getByLabelText("Email"),
      "definitely-does-not-exist@example.com",
    );
    await user.click(
      screen.getByRole("button", { name: "Send reset instructions" }),
    );

    expect(
      await screen.findByText(
        "If an account exists for that email, password reset instructions will be sent.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/does not exist|no account/i),
    ).not.toBeInTheDocument();
  });

  it("shows an accessible pending state while submitting", async () => {
    let resolveAction!: (value: { status: "idle" }) => void;
    forgotPasswordActionMock.mockReturnValue(
      new Promise((resolve) => {
        resolveAction = resolve;
      }),
    );

    const user = userEvent.setup();
    render(<ForgotPasswordForm />);

    await user.type(screen.getByLabelText("Email"), "asha@example.com");
    await user.click(
      screen.getByRole("button", { name: "Send reset instructions" }),
    );

    expect(
      await screen.findByRole("button", { name: "Sending…" }),
    ).toBeDisabled();

    resolveAction({ status: "idle" });
  });
});
