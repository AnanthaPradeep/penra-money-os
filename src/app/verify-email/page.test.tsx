import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/actions", () => ({
  resendVerificationAction: vi.fn(),
}));

import VerifyEmailPage from "@/app/verify-email/page";

describe("VerifyEmailPage", () => {
  it("explains that the user should check their inbox", () => {
    render(<VerifyEmailPage />);

    expect(
      screen.getByRole("heading", { name: "Check your inbox" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/confirmation link/i)).toBeInTheDocument();
  });

  it("never places an email address anywhere in the page", () => {
    render(<VerifyEmailPage />);

    // No @-containing email-looking string anywhere in the rendered output.
    expect(document.body.textContent).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.-]+/);
  });

  it("provides a resend-confirmation form with an accessible, correctly typed email field", () => {
    render(<VerifyEmailPage />);

    const emailField = screen.getByLabelText("Email");
    expect(emailField).toHaveAttribute("type", "email");
    expect(emailField).toHaveAttribute("autocomplete", "email");
    expect(
      screen.getByRole("button", { name: "Resend confirmation email" }),
    ).toBeInTheDocument();
  });
});
