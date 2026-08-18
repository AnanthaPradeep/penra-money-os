import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StatusBadge } from "@/components/ui/StatusBadge";

describe("StatusBadge", () => {
  it.each([
    ["active", "Active"],
    ["archived", "Archived"],
    ["posted", "Posted"],
    ["reversed", "Reversed"],
  ] as const)("renders a readable label for status %s", (status, label) => {
    render(<StatusBadge status={status} />);

    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it("pairs every status with a distinct icon, not colour alone", () => {
    const { container: activeContainer } = render(
      <StatusBadge status="active" />,
    );
    const { container: archivedContainer } = render(
      <StatusBadge status="archived" />,
    );

    const activeIcon = activeContainer
      .querySelector("svg")
      ?.getAttribute("class");
    const archivedIcon = archivedContainer
      .querySelector("svg")
      ?.getAttribute("class");

    expect(activeIcon).toBeTruthy();
    expect(archivedIcon).toBeTruthy();
    expect(activeIcon).not.toBe(archivedIcon);
  });

  it("hides the icon from assistive technology, relying on the text label", () => {
    render(<StatusBadge status="reversed" />);

    expect(document.querySelector("svg")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });
});
