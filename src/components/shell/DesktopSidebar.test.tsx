import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "next-themes";
import type { usePathname } from "next/navigation";
import { describe, expect, it, vi } from "vitest";

const usePathnameMock = vi.fn<typeof usePathname>();
vi.mock("next/navigation", () => ({
  usePathname: () => usePathnameMock(),
}));

vi.mock("@/lib/auth/actions", () => ({
  logOutAction: vi.fn(),
}));

import { DesktopSidebar } from "@/components/shell/DesktopSidebar";

function renderSidebar(props: {
  displayName: string | null;
  email: string | null;
}) {
  return render(
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <DesktopSidebar {...props} />
    </ThemeProvider>,
  );
}

describe("DesktopSidebar", () => {
  it("renders the product wordmark", () => {
    usePathnameMock.mockReturnValue("/app");
    renderSidebar({ displayName: "Asha Rao", email: "asha@example.com" });

    expect(screen.getByText("PENRA Money OS")).toBeInTheDocument();
  });

  it("renders a prominent quick action to add a transaction", () => {
    usePathnameMock.mockReturnValue("/app");
    renderSidebar({ displayName: "Asha Rao", email: "asha@example.com" });

    expect(
      screen.getByRole("link", { name: /new transaction/i }),
    ).toHaveAttribute("href", "/app/transactions/new");
  });

  it("marks the active route in the primary navigation", () => {
    usePathnameMock.mockReturnValue("/app/accounts");
    renderSidebar({ displayName: "Asha Rao", email: "asha@example.com" });

    const nav = screen.getByRole("navigation", { name: "Primary" });
    expect(within(nav).getByRole("link", { name: "Accounts" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("shows the display name in the account menu trigger", () => {
    usePathnameMock.mockReturnValue("/app");
    renderSidebar({ displayName: "Asha Rao", email: "asha@example.com" });

    expect(screen.getByText("Asha Rao")).toBeInTheDocument();
  });

  it("falls back to the email when no display name is set", () => {
    usePathnameMock.mockReturnValue("/app");
    renderSidebar({ displayName: null, email: "asha@example.com" });

    expect(screen.getByText("asha@example.com")).toBeInTheDocument();
  });

  it("exposes profile settings and logout from the account menu", async () => {
    usePathnameMock.mockReturnValue("/app");
    const user = userEvent.setup();
    renderSidebar({ displayName: "Asha Rao", email: "asha@example.com" });

    await user.click(screen.getByRole("button", { name: /asha rao/i }));

    expect(
      screen.getByRole("menuitem", { name: /profile settings/i }),
    ).toHaveAttribute("href", "/app/settings/profile");
    expect(screen.getByRole("button", { name: "Log out" })).toBeInTheDocument();
  });

  it("includes an accessible theme switcher", () => {
    usePathnameMock.mockReturnValue("/app");
    renderSidebar({ displayName: "Asha Rao", email: "asha@example.com" });

    expect(
      screen.getByRole("button", { name: "Change theme" }),
    ).toBeInTheDocument();
  });
});
