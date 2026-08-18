import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { PasswordInput } from "@/components/ui/PasswordInput";

describe("PasswordInput", () => {
  it("masks the value by default", () => {
    render(<PasswordInput id="pw" name="password" />);

    expect(document.getElementById("pw")).toHaveAttribute("type", "password");
  });

  it("reveals the value when the show/hide toggle is clicked", async () => {
    const user = userEvent.setup();
    render(<PasswordInput id="pw" name="password" />);

    const toggle = screen.getByRole("button", { name: "Show password" });
    await user.click(toggle);

    expect(document.getElementById("pw")).toHaveAttribute("type", "text");
    expect(
      screen.getByRole("button", { name: "Hide password" }),
    ).toBeInTheDocument();
  });

  it("hides the value again on a second toggle click", async () => {
    const user = userEvent.setup();
    render(<PasswordInput id="pw" name="password" />);

    await user.click(screen.getByRole("button", { name: "Show password" }));
    await user.click(screen.getByRole("button", { name: "Hide password" }));

    expect(document.getElementById("pw")).toHaveAttribute("type", "password");
  });

  it("updates aria-pressed to reflect the toggle state", async () => {
    const user = userEvent.setup();
    render(<PasswordInput id="pw" name="password" />);

    const toggle = screen.getByRole("button", { name: "Show password" });
    expect(toggle).toHaveAttribute("aria-pressed", "false");

    await user.click(toggle);

    expect(
      screen.getByRole("button", { name: "Hide password" }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("the toggle button is type=button so it never submits the form", () => {
    render(<PasswordInput id="pw" name="password" />);

    expect(
      screen.getByRole("button", { name: "Show password" }),
    ).toHaveAttribute("type", "button");
  });
});
