import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ErrorState } from "@/components/ui/ErrorState";

describe("ErrorState", () => {
  it("renders a safe, generic message by default", () => {
    render(<ErrorState />);

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Something went wrong");
    expect(alert.textContent).not.toMatch(/postgres|sql|stack|exception/i);
  });

  it("never renders a raw backend error object", () => {
    render(
      <ErrorState description="We couldn't load this page. Please try again." />,
    );

    expect(document.body.textContent).not.toMatch(
      /postgres|prisma|at\s+\w+\s+\(/i,
    );
  });

  it("offers a retry action only when onRetry is provided", () => {
    const { rerender } = render(<ErrorState />);
    expect(
      screen.queryByRole("button", { name: "Try again" }),
    ).not.toBeInTheDocument();

    const onRetry = vi.fn();
    rerender(<ErrorState onRetry={onRetry} />);
    expect(
      screen.getByRole("button", { name: "Try again" }),
    ).toBeInTheDocument();
  });

  it("calls onRetry when the retry button is clicked", async () => {
    const onRetry = vi.fn();
    const user = userEvent.setup();
    render(<ErrorState onRetry={onRetry} />);

    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
