import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "next-themes";
import { describe, expect, it } from "vitest";

import { ThemeSwitcher } from "@/components/theme/ThemeSwitcher";

function renderWithProvider() {
  return render(
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <ThemeSwitcher />
    </ThemeProvider>,
  );
}

describe("ThemeSwitcher", () => {
  it("has an accessible name", () => {
    renderWithProvider();

    expect(
      screen.getByRole("button", { name: "Change theme" }),
    ).toBeInTheDocument();
  });

  it("opens a menu with Light, Dark, and System options", async () => {
    const user = userEvent.setup();
    renderWithProvider();

    await user.click(screen.getByRole("button", { name: "Change theme" }));

    expect(
      screen.getByRole("menuitem", { name: /light/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /dark/i })).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: /system/i }),
    ).toBeInTheDocument();
  });

  it("is keyboard operable", async () => {
    const user = userEvent.setup();
    renderWithProvider();

    await user.tab();
    expect(screen.getByRole("button", { name: "Change theme" })).toHaveFocus();

    await user.keyboard("{Enter}");
    expect(
      screen.getByRole("menuitem", { name: /light/i }),
    ).toBeInTheDocument();
  });

  it("selecting an option closes the menu", async () => {
    const user = userEvent.setup();
    renderWithProvider();

    await user.click(screen.getByRole("button", { name: "Change theme" }));
    await user.click(screen.getByRole("menuitem", { name: /dark/i }));

    expect(
      screen.queryByRole("menuitem", { name: /dark/i }),
    ).not.toBeInTheDocument();
  });
});
