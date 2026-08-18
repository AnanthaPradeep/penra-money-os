import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { EmptyState } from "@/components/ui/EmptyState";

describe("EmptyState", () => {
  it("renders the title and description", () => {
    render(
      <EmptyState
        title="No accounts yet"
        description="Add your first account to get started."
      />,
    );

    expect(screen.getByText("No accounts yet")).toBeInTheDocument();
    expect(
      screen.getByText("Add your first account to get started."),
    ).toBeInTheDocument();
  });

  it("renders exactly one clear next action when provided", () => {
    render(
      <EmptyState
        title="No accounts yet"
        action={<button type="button">Add account</button>}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Add account" }),
    ).toBeInTheDocument();
  });

  it("hides its decorative icon from assistive technology", () => {
    render(
      <EmptyState title="No accounts yet" icon={<svg data-testid="icon" />} />,
    );

    const iconWrapper = screen.getByTestId("icon").parentElement;
    expect(iconWrapper).toHaveAttribute("aria-hidden", "true");
  });
});
