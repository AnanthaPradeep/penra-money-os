import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const getAuthenticatedUserMock = vi.fn();
vi.mock("@/lib/auth/session", () => ({
  getAuthenticatedUser: (...args: unknown[]) =>
    getAuthenticatedUserMock(...args),
}));

vi.mock("@/lib/auth/actions", () => ({
  resetPasswordAction: vi.fn(),
}));

describe("ResetPasswordPage", () => {
  it("shows a safe expired-or-invalid-link state when there is no valid session", async () => {
    getAuthenticatedUserMock.mockResolvedValue(null);
    const { default: ResetPasswordPage } =
      await import("@/app/reset-password/page");

    render(await ResetPasswordPage());

    expect(
      screen.getByRole("heading", { name: "Link invalid or expired" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "This password reset link is invalid or has expired. Please request a new one.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Request a new link" }),
    ).toHaveAttribute("href", "/forgot-password");
    // The password form itself must not render in this state.
    expect(screen.queryByLabelText("New password")).not.toBeInTheDocument();
  });

  it("shows the reset-password form when a valid recovery/auth session exists", async () => {
    getAuthenticatedUserMock.mockResolvedValue({
      id: "user-1",
      email: "asha@example.com",
    });
    const { default: ResetPasswordPage } =
      await import("@/app/reset-password/page");

    render(await ResetPasswordPage());

    expect(
      screen.getByRole("heading", { name: "Set a new password" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("New password")).toBeInTheDocument();
    expect(screen.getByLabelText("Confirm new password")).toBeInTheDocument();
  });
});
