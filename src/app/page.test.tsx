import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Home from "./page";

describe("Home (foundation page)", () => {
  it("renders the product name", () => {
    render(<Home />);

    expect(
      screen.getByRole("heading", { level: 1, name: "PENRA Money OS" }),
    ).toBeInTheDocument();
  });

  it("renders the short description", () => {
    render(<Home />);

    expect(
      screen.getByText("Your private personal money operating system."),
    ).toBeInTheDocument();
  });

  it("makes clear that finance features are not yet enabled", () => {
    render(<Home />);

    expect(
      screen.getByText(/finance features are not yet enabled/i),
    ).toBeInTheDocument();
  });

  it("contains no fake financial values", () => {
    render(<Home />);

    const text = document.body.textContent ?? "";

    // No currency amounts, no rupee symbol, no percentage-style figures —
    // this is a foundation page, not a dashboard with sample data.
    expect(text).not.toMatch(/₹/);
    expect(text).not.toMatch(/\$\d/);
    expect(text).not.toMatch(/\d[.,]\d{2}\b/);
    expect(text.toLowerCase()).not.toMatch(/balance:\s*\d/);
  });

  it("uses a single top-level heading for correct document structure", () => {
    render(<Home />);

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  it("links to the login and signup pages", () => {
    render(<Home />);

    expect(screen.getByRole("link", { name: "Log in" })).toHaveAttribute(
      "href",
      "/login",
    );
    expect(screen.getByRole("link", { name: "Sign up" })).toHaveAttribute(
      "href",
      "/signup",
    );
  });
});
