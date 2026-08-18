import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PageHeader } from "@/components/ui/PageHeader";

describe("PageHeader", () => {
  it("renders the title as the page's single h1", () => {
    render(<PageHeader title="Accounts" />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Accounts" }),
    ).toBeInTheDocument();
  });

  it("renders an optional description", () => {
    render(
      <PageHeader title="Accounts" description="Every account you've added." />,
    );

    expect(screen.getByText("Every account you've added.")).toBeInTheDocument();
  });

  it("renders optional eyebrow content above the title", () => {
    render(
      <PageHeader
        title="New account"
        eyebrow={<span>Back to accounts</span>}
      />,
    );

    expect(screen.getByText("Back to accounts")).toBeInTheDocument();
  });

  it("renders optional actions", () => {
    render(
      <PageHeader
        title="Accounts"
        actions={<button type="button">New account</button>}
      />,
    );

    expect(
      screen.getByRole("button", { name: "New account" }),
    ).toBeInTheDocument();
  });
});
