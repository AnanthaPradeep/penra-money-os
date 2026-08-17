import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const logOutActionMock = vi.fn();
vi.mock("@/lib/auth/actions", () => ({
  logOutAction: (...args: unknown[]) => logOutActionMock(...args),
}));

import { LogoutButton } from "@/components/auth/LogoutButton";

describe("LogoutButton", () => {
  it("renders as a form bound to the logout Server Action, not a plain link", () => {
    const { container } = render(<LogoutButton />);

    const form = container.querySelector("form");
    expect(form).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /log out/i }),
    ).not.toBeInTheDocument();
  });

  it("renders an accessible submit button, not a state-changing GET link", () => {
    render(<LogoutButton />);

    const button = screen.getByRole("button", { name: "Log out" });
    expect(button).toHaveAttribute("type", "submit");
  });
});
