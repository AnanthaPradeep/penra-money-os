import { render, screen } from "@testing-library/react";
import { Home } from "lucide-react";
import { describe, expect, it } from "vitest";

import { DesktopNavItem } from "@/components/shell/DesktopNavItem";

const ITEM = { href: "/app", label: "Home", icon: Home };

describe("DesktopNavItem", () => {
  it("renders a link to its route", () => {
    render(<DesktopNavItem item={ITEM} isActive={false} />);

    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute(
      "href",
      "/app",
    );
  });

  it("marks the current route with aria-current, not colour alone", () => {
    render(<DesktopNavItem item={ITEM} isActive />);

    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("does not mark aria-current when inactive", () => {
    render(<DesktopNavItem item={ITEM} isActive={false} />);

    expect(screen.getByRole("link", { name: "Home" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("hides its icon from assistive technology", () => {
    render(<DesktopNavItem item={ITEM} isActive={false} />);

    expect(document.querySelector("svg")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });
});
