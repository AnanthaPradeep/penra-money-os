import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AmountDisplay } from "@/components/ui/AmountDisplay";
import { Decimal } from "@/lib/money/decimal";

describe("AmountDisplay", () => {
  it("renders a neutral amount with tabular numerals, no icon or forced sign", () => {
    render(<AmountDisplay value={new Decimal("50000")} />);

    const el = screen.getByText("₹50,000.00");
    expect(el).toHaveClass("tabular-nums");
    expect(document.querySelector("svg")).not.toBeInTheDocument();
  });

  it("renders a signed positive amount with a '+' prefix, an icon, and the positive colour token", () => {
    render(<AmountDisplay value={new Decimal("500")} variant="signed" />);

    expect(screen.getByText("+")).toBeInTheDocument();
    expect(screen.getByText("₹500.00")).toBeInTheDocument();
    expect(document.querySelector("svg")).toBeInTheDocument();
    const wrapper = screen.getByText("₹500.00").closest("span.text-positive");
    expect(wrapper).not.toBeNull();
  });

  it("renders a signed negative amount with the native minus sign and the negative colour token", () => {
    render(<AmountDisplay value={new Decimal("-500")} variant="signed" />);

    expect(screen.getByText("-₹500.00")).toBeInTheDocument();
    const wrapper = screen.getByText("-₹500.00").closest("span.text-negative");
    expect(wrapper).not.toBeNull();
  });

  it("does not rely on colour alone — every signed amount also has a direction icon and sr-only text", () => {
    render(<AmountDisplay value={new Decimal("500")} variant="signed" />);

    expect(
      document.querySelector("svg[aria-hidden='true']"),
    ).toBeInTheDocument();
    expect(screen.getByText(/increase of/i)).toBeInTheDocument();
  });

  it("accepts a plain string value", () => {
    render(<AmountDisplay value="1234.5" />);

    expect(screen.getByText("₹1,234.50")).toBeInTheDocument();
  });
});
