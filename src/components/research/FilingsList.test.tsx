import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { createCompanyFilingAction as CreateCompanyFilingAction } from "@/lib/research/actions";
import type { CompanyFiling } from "@/lib/research/mapping";

const createCompanyFilingActionMock = vi.fn<typeof CreateCompanyFilingAction>();
vi.mock("@/lib/research/actions", () => ({
  createCompanyFilingAction: (
    ...args: Parameters<typeof CreateCompanyFilingAction>
  ) => createCompanyFilingActionMock(...args),
}));

const refreshMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

import { FilingsList } from "@/components/research/FilingsList";

function filing(overrides: Partial<CompanyFiling>): CompanyFiling {
  return {
    id: "filing-1",
    userId: "user-1",
    instrumentId: "instrument-1",
    category: "annual_report",
    title: "FY2025 Annual Report",
    filingDate: "2025-05-01",
    sourceDomain: "www.nseindia.com",
    sourceUrl: "https://www.nseindia.com/annual-report.pdf",
    providerDocumentId: null,
    isVerified: false,
    notes: null,
    createdAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("FilingsList", () => {
  it("shows an empty message with no filings", () => {
    render(<FilingsList instrumentId="instrument-1" filings={[]} />);
    expect(screen.getByText("No filing links added yet.")).toBeInTheDocument();
  });

  it("shows each filing as an external link with its category and domain", () => {
    render(<FilingsList instrumentId="instrument-1" filings={[filing({})]} />);

    const link = screen.getByRole("link", { name: /FY2025 Annual Report/ });
    expect(link).toHaveAttribute(
      "href",
      "https://www.nseindia.com/annual-report.pdf",
    );
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
    expect(screen.getByText(/www\.nseindia\.com/)).toBeInTheDocument();
    expect(screen.getByText("Annual report")).toBeInTheDocument();
  });

  it("shows a verified badge only when the user marked it verified themself", () => {
    const { rerender } = render(
      <FilingsList instrumentId="instrument-1" filings={[filing({})]} />,
    );
    expect(screen.queryByText("Verified by you")).not.toBeInTheDocument();

    rerender(
      <FilingsList
        instrumentId="instrument-1"
        filings={[filing({ isVerified: true })]}
      />,
    );
    expect(screen.getByText("Verified by you")).toBeInTheDocument();
  });

  it("adds a filing link and refreshes on success", async () => {
    createCompanyFilingActionMock.mockResolvedValue({
      status: "success",
      message: "Filing link added.",
      id: "filing-new",
    });
    const user = userEvent.setup();
    render(<FilingsList instrumentId="instrument-1" filings={[]} />);

    await user.click(
      screen.getAllByRole("button", { name: "Add filing link" })[0]!,
    );
    await user.type(screen.getByLabelText("Title"), "Q1 FY26 results");
    await user.type(
      screen.getByLabelText("Source URL"),
      "https://www.bseindia.com/q1-results.pdf",
    );
    await user.click(screen.getByRole("button", { name: "Add filing link" }));

    await waitFor(() =>
      expect(createCompanyFilingActionMock).toHaveBeenCalled(),
    );
    const formData = createCompanyFilingActionMock.mock.calls[0]?.[1];
    expect(formData?.get("instrumentId")).toBe("instrument-1");
    expect(formData?.get("title")).toBe("Q1 FY26 results");
    expect(formData?.get("sourceUrl")).toBe(
      "https://www.bseindia.com/q1-results.pdf",
    );
    await waitFor(() => expect(refreshMock).toHaveBeenCalled());
  });
});
