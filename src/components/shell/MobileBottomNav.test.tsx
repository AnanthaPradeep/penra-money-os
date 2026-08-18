import { render, screen } from "@testing-library/react";
import type { usePathname } from "next/navigation";
import { describe, expect, it, vi } from "vitest";

const usePathnameMock = vi.fn<typeof usePathname>();
vi.mock("next/navigation", () => ({
  usePathname: () => usePathnameMock(),
}));

import { MobileBottomNav } from "@/components/shell/MobileBottomNav";

describe("MobileBottomNav", () => {
  it("renders the four core routes", () => {
    usePathnameMock.mockReturnValue("/app");
    render(<MobileBottomNav />);

    expect(screen.getByRole("link", { name: "Home" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Accounts" })).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Add transaction" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Profile" })).toBeInTheDocument();
  });

  it("marks the current route as active via aria-current", () => {
    usePathnameMock.mockReturnValue("/app/accounts");
    render(<MobileBottomNav />);

    expect(screen.getByRole("link", { name: "Accounts" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Home" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("marks a nested account detail route as still under Accounts", () => {
    usePathnameMock.mockReturnValue("/app/accounts/acct-1");
    render(<MobileBottomNav />);

    expect(screen.getByRole("link", { name: "Accounts" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("is a labelled navigation landmark", () => {
    usePathnameMock.mockReturnValue("/app");
    render(<MobileBottomNav />);

    expect(
      screen.getByRole("navigation", { name: "Primary" }),
    ).toBeInTheDocument();
  });
});
