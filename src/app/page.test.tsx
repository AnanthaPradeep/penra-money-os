import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import LandingPage from "./page";

describe("LandingPage", () => {
  it("renders the product name and value proposition", () => {
    render(<LandingPage />);

    expect(screen.getAllByText("PENRA Money OS").length).toBeGreaterThan(0);
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Your private personal money operating system.",
      }),
    ).toBeInTheDocument();
  });

  it("contains no fake financial values", () => {
    render(<LandingPage />);

    const text = document.body.textContent ?? "";

    // No currency amounts, no rupee symbol, no percentage-style figures —
    // this is a marketing/entry page, not a dashboard with sample data.
    expect(text).not.toMatch(/₹/);
    expect(text).not.toMatch(/\$\d/);
    expect(text).not.toMatch(/\d[.,]\d{2}\b/);
    expect(text.toLowerCase()).not.toMatch(/balance:\s*\d/);
  });

  it("contains no fake social proof", () => {
    render(<LandingPage />);

    const text = document.body.textContent ?? "";
    expect(text.toLowerCase()).not.toMatch(
      /customers|users trust|testimonial|★/,
    );
  });

  it("uses a single top-level heading for correct document structure", () => {
    render(<LandingPage />);

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  it("links to signup", () => {
    render(<LandingPage />);

    expect(
      screen.getByRole("link", { name: /create your account/i }),
    ).toHaveAttribute("href", "/signup");
  });

  it("links to login", () => {
    render(<LandingPage />);

    const loginLinks = screen.getAllByRole("link", { name: "Log in" });
    expect(loginLinks.length).toBeGreaterThan(0);
    for (const link of loginLinks) {
      expect(link).toHaveAttribute("href", "/login");
    }
  });

  it("includes an accessible theme switcher", () => {
    render(<LandingPage />);

    expect(
      screen.getByRole("button", { name: "Change theme" }),
    ).toBeInTheDocument();
  });
});
