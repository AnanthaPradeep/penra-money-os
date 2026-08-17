import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const signUpActionMock = vi.fn();
vi.mock("@/lib/auth/actions", () => ({
  signUpAction: (...args: unknown[]) => signUpActionMock(...args),
}));

import { SignupForm } from "@/components/auth/SignupForm";

describe("SignupForm", () => {
  it("renders every field with an accessible, associated label", () => {
    render(<SignupForm />);

    expect(screen.getByLabelText("Name")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByLabelText("Confirm password")).toBeInTheDocument();
  });

  it("uses the correct input types and autocomplete values", () => {
    render(<SignupForm />);

    expect(screen.getByLabelText("Name")).toHaveAttribute(
      "autocomplete",
      "name",
    );
    expect(screen.getByLabelText("Email")).toHaveAttribute("type", "email");
    expect(screen.getByLabelText("Email")).toHaveAttribute(
      "autocomplete",
      "email",
    );
    expect(screen.getByLabelText("Password")).toHaveAttribute(
      "type",
      "password",
    );
    expect(screen.getByLabelText("Password")).toHaveAttribute(
      "autocomplete",
      "new-password",
    );
    expect(screen.getByLabelText("Confirm password")).toHaveAttribute(
      "autocomplete",
      "new-password",
    );
  });

  it("has no social login buttons and no phone/financial fields", () => {
    render(<SignupForm />);

    expect(
      screen.queryByRole("button", { name: /google|github|apple/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/phone/i)).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText(/balance|account number/i),
    ).not.toBeInTheDocument();
  });

  it("includes a link to the login page", () => {
    render(<SignupForm />);

    expect(screen.getByRole("link", { name: "Log in" })).toHaveAttribute(
      "href",
      "/login",
    );
  });

  it("passes the safe next path through as a hidden field", () => {
    render(<SignupForm next="/app/settings/profile" />);

    const hidden = document.querySelector('input[name="next"]');
    expect(hidden).toHaveAttribute("value", "/app/settings/profile");
    expect(hidden).toHaveAttribute("type", "hidden");
  });

  it("shows a disabled, busy submit button while pending, then re-enables it", async () => {
    let resolveAction!: (value: { status: "idle" }) => void;
    signUpActionMock.mockReturnValue(
      new Promise((resolve) => {
        resolveAction = resolve;
      }),
    );

    const user = userEvent.setup();
    render(<SignupForm />);

    await user.type(screen.getByLabelText("Name"), "Asha Rao");
    await user.type(screen.getByLabelText("Email"), "asha@example.com");
    await user.type(
      screen.getByLabelText("Password"),
      "correct horse battery staple",
    );
    await user.type(
      screen.getByLabelText("Confirm password"),
      "correct horse battery staple",
    );

    const submitButton = screen.getByRole("button", {
      name: /create account|creating your account/i,
    });
    await user.click(submitButton);

    expect(
      await screen.findByRole("button", { name: "Creating your account…" }),
    ).toBeDisabled();

    resolveAction({ status: "idle" });

    expect(
      await screen.findByRole("button", { name: "Create account" }),
    ).not.toBeDisabled();
  });

  it("renders a safe, already-normalised error message in an accessible alert region", async () => {
    signUpActionMock.mockResolvedValue({
      status: "error",
      message: "The email or password you entered is incorrect.",
    });

    const user = userEvent.setup();
    render(<SignupForm />);

    await user.type(screen.getByLabelText("Name"), "Asha Rao");
    await user.type(screen.getByLabelText("Email"), "asha@example.com");
    await user.type(
      screen.getByLabelText("Password"),
      "correct horse battery staple",
    );
    await user.type(
      screen.getByLabelText("Confirm password"),
      "correct horse battery staple",
    );
    await user.click(screen.getByRole("button", { name: "Create account" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      "The email or password you entered is incorrect.",
    );
  });

  it("renders per-field errors linked to their input via aria-describedby", async () => {
    signUpActionMock.mockResolvedValue({
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: { email: "Enter a valid email address." },
    });

    const user = userEvent.setup();
    render(<SignupForm />);

    await user.type(screen.getByLabelText("Name"), "Asha Rao");
    await user.type(screen.getByLabelText("Email"), "not-an-email");
    await user.type(
      screen.getByLabelText("Password"),
      "correct horse battery staple",
    );
    await user.type(
      screen.getByLabelText("Confirm password"),
      "correct horse battery staple",
    );
    await user.click(screen.getByRole("button", { name: "Create account" }));

    // Wait for the error text itself (which only exists post-update)
    // before inspecting the input, so the DOM is guaranteed to reflect the
    // resolved action state.
    await screen.findByText("Enter a valid email address.");

    const emailInput = screen.getByLabelText("Email");
    expect(emailInput).toHaveAttribute("aria-invalid", "true");
    const describedBy = emailInput.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy!)).toHaveTextContent(
      "Enter a valid email address.",
    );
  });
});
