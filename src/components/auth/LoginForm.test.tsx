import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const logInActionMock = vi.fn();
vi.mock("@/lib/auth/actions", () => ({
  logInAction: (...args: unknown[]) => logInActionMock(...args),
}));

import { LoginForm } from "@/components/auth/LoginForm";

describe("LoginForm", () => {
  it("renders accessible, correctly typed fields", () => {
    render(<LoginForm />);

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
      "current-password",
    );
  });

  it("links to signup and forgot-password", () => {
    render(<LoginForm />);

    expect(screen.getByRole("link", { name: "Sign up" })).toHaveAttribute(
      "href",
      "/signup",
    );
    expect(
      screen.getByRole("link", { name: "Forgot your password?" }),
    ).toHaveAttribute("href", "/forgot-password");
  });

  it("passes a safe next path through as a hidden field", () => {
    render(<LoginForm next="/app/settings/profile" />);

    expect(document.querySelector('input[name="next"]')).toHaveAttribute(
      "value",
      "/app/settings/profile",
    );
  });

  it("shows an accessible pending state while submitting", async () => {
    let resolveAction!: (value: { status: "idle" }) => void;
    logInActionMock.mockReturnValue(
      new Promise((resolve) => {
        resolveAction = resolve;
      }),
    );

    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByLabelText("Email"), "asha@example.com");
    await user.type(screen.getByLabelText("Password"), "whatever-password");
    await user.click(screen.getByRole("button", { name: "Log in" }));

    const pendingButton = await screen.findByRole("button", {
      name: "Signing in…",
    });
    expect(pendingButton).toBeDisabled();
    expect(pendingButton).toHaveAttribute("aria-busy", "true");

    resolveAction({ status: "idle" });
    expect(
      await screen.findByRole("button", { name: "Log in" }),
    ).not.toBeDisabled();
  });

  it("renders a safe, generic invalid-credentials message, never a raw Supabase string", async () => {
    logInActionMock.mockResolvedValue({
      status: "error",
      message: "The email or password you entered is incorrect.",
    });

    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByLabelText("Email"), "asha@example.com");
    await user.type(screen.getByLabelText("Password"), "wrong-password");
    await user.click(screen.getByRole("button", { name: "Log in" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      "The email or password you entered is incorrect.",
    );
    expect(alert.textContent).not.toMatch(/supabase|sql|stack/i);
  });
});
