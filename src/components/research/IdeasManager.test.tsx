import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { createInvestmentIdeaAction as CreateInvestmentIdeaAction } from "@/lib/research/actions";
import type { searchMarketInstrumentsAction as SearchMarketInstrumentsAction } from "@/lib/market-data/actions";
import type { MarketInstrument } from "@/lib/market-data/mapping";
import type { InvestmentIdea } from "@/lib/research/mapping";

const createInvestmentIdeaActionMock =
  vi.fn<typeof CreateInvestmentIdeaAction>();
vi.mock("@/lib/research/actions", () => ({
  createInvestmentIdeaAction: (
    ...args: Parameters<typeof CreateInvestmentIdeaAction>
  ) => createInvestmentIdeaActionMock(...args),
}));

const searchMarketInstrumentsActionMock =
  vi.fn<typeof SearchMarketInstrumentsAction>();
vi.mock("@/lib/market-data/actions", () => ({
  searchMarketInstrumentsAction: (
    ...args: Parameters<typeof SearchMarketInstrumentsAction>
  ) => searchMarketInstrumentsActionMock(...args),
}));

const refreshMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

import { IdeasManager } from "@/components/research/IdeasManager";

function instrument(overrides: Partial<MarketInstrument>): MarketInstrument {
  return {
    id: "instrument-1",
    provider: "twelve_data",
    providerInstrumentId: "TCS",
    symbol: "TCS",
    exchange: "NSE",
    mic: null,
    isin: null,
    name: "Tata Consultancy Services",
    instrumentKind: "stock",
    quoteCurrency: "INR",
    timezone: "Asia/Kolkata",
    isActive: true,
    lastSuccessfulRefreshAt: null,
    ...overrides,
  };
}

function idea(overrides: Partial<InvestmentIdea>): InvestmentIdea {
  return {
    id: "idea-1",
    userId: "user-1",
    instrumentId: "instrument-1",
    thesisId: null,
    title: "Margin recovery play",
    status: "researching",
    priority: "medium",
    origin: null,
    rationale: null,
    riskNotes: null,
    nextReviewDate: null,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("IdeasManager", () => {
  it("shows an empty state with no ideas", () => {
    render(<IdeasManager ideas={[]} instrumentsById={{}} />);
    expect(screen.getByText("Capture your first idea")).toBeInTheDocument();
  });

  it("groups ideas by status with a count badge per section", () => {
    render(
      <IdeasManager
        ideas={[
          idea({}),
          idea({
            id: "idea-2",
            status: "watching",
            title: "Turnaround candidate",
          }),
        ]}
        instrumentsById={{ "instrument-1": instrument({}) }}
      />,
    );

    expect(
      screen.getByRole("heading", { level: 2, name: /Researching/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: /Watching/ }),
    ).toBeInTheDocument();
    expect(screen.getByText("Margin recovery play")).toBeInTheDocument();
    expect(screen.getAllByText("Tata Consultancy Services")).toHaveLength(2);
  });

  it("links each idea card to its detail page", () => {
    render(
      <IdeasManager
        ideas={[idea({})]}
        instrumentsById={{ "instrument-1": instrument({}) }}
      />,
    );

    expect(
      screen.getByRole("link", { name: /Margin recovery play/ }),
    ).toHaveAttribute("href", "/app/research/ideas/idea-1");
  });

  it("creates an idea after picking a company and refreshes", async () => {
    searchMarketInstrumentsActionMock.mockResolvedValue({
      status: "success",
      results: [instrument({})],
    });
    createInvestmentIdeaActionMock.mockResolvedValue({
      status: "success",
      message: "Idea captured.",
      id: "idea-new",
    });
    const user = userEvent.setup();
    render(<IdeasManager ideas={[]} instrumentsById={{}} />);

    await user.click(screen.getAllByRole("button", { name: "New idea" })[0]!);
    await user.type(screen.getByLabelText("Company"), "Tata Consultancy");
    await user.click(
      await screen.findByRole("button", {
        name: /Tata Consultancy Services/,
      }),
    );
    await user.type(screen.getByLabelText("Title"), "Undervalued spinoff");
    await user.click(screen.getByRole("button", { name: "Capture idea" }));

    await waitFor(() =>
      expect(createInvestmentIdeaActionMock).toHaveBeenCalled(),
    );
    const formData = createInvestmentIdeaActionMock.mock.calls[0]?.[1];
    expect(formData?.get("instrumentId")).toBe("instrument-1");
    expect(formData?.get("title")).toBe("Undervalued spinoff");
    await waitFor(() => expect(refreshMock).toHaveBeenCalled());
  });
});
