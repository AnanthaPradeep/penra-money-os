import { render, screen } from "@testing-library/react";
import { Home } from "lucide-react";
import { describe, expect, it } from "vitest";

import { MobileNavItem } from "@/components/shell/MobileNavItem";

const ITEM = { href: "/app/accounts", label: "Accounts", icon: Home };

describe("MobileNavItem", () => {
  it("renders a link to its route with a visible label", () => {
    render(<MobileNavItem item={ITEM} isActive={false} />);

    const link = screen.getByRole("link", { name: "Accounts" });
    expect(link).toHaveAttribute("href", "/app/accounts");
    expect(link).toHaveTextContent("Accounts");
  });

  it("marks the current route with aria-current", () => {
    render(<MobileNavItem item={ITEM} isActive />);

    expect(screen.getByRole("link", { name: "Accounts" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("meets the minimum comfortable touch-target height", () => {
    render(<MobileNavItem item={ITEM} isActive={false} />);

    expect(screen.getByRole("link", { name: "Accounts" })).toHaveClass(
      "min-h-11",
    );
  });
});
