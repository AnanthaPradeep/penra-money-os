import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { InvestmentAsset } from "@/lib/investments/mapping";
import type {
  linkMarketInstrumentAction,
  searchMarketInstrumentsAction,
  unlinkMarketInstrumentAction,
} from "@/lib/market-data/actions";
import type { MarketInstrument } from "@/lib/market-data/mapping";

const searchMarketInstrumentsActionMock =
  vi.fn<typeof searchMarketInstrumentsAction>();
const linkMarketInstrumentActionMock =
  vi.fn<typeof linkMarketInstrumentAction>();
const unlinkMarketInstrumentActionMock =
  vi.fn<typeof unlinkMarketInstrumentAction>();
vi.mock("@/lib/market-data/actions", () => ({
  searchMarketInstrumentsAction: (
    ...args: Parameters<typeof searchMarketInstrumentsAction>
  ) => searchMarketInstrumentsActionMock(...args),
  linkMarketInstrumentAction: (
    ...args: Parameters<typeof linkMarketInstrumentAction>
  ) => linkMarketInstrumentActionMock(...args),
  unlinkMarketInstrumentAction: (
    ...args: Parameters<typeof unlinkMarketInstrumentAction>
  ) => unlinkMarketInstrumentActionMock(...args),
}));

const refreshMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

import { MarketInstrumentLinkPanel } from "@/components/market-data/MarketInstrumentLinkPanel";

function asset(overrides: Partial<InvestmentAsset>): InvestmentAsset {
  return {
    id: "asset-1",
    assetKind: "mutual_fund",
    displayName: "Test Fund",
    symbol: null,
    exchange: null,
    isin: null,
    schemeCode: null,
    currency: "INR",
    unitPrecision: 4,
    investmentAccountId: null,
    status: "active",
    notes: null,
    marketInstrumentId: null,
    marketLinkConfirmedAt: null,
    ...overrides,
  };
}

function instrument(overrides: Partial<MarketInstrument>): MarketInstrument {
  return {
    id: "instrument-1",
    provider: "amfi",
    providerInstrumentId: "119551",
    symbol: null,
    exchange: null,
    mic: null,
    isin: "INF209KA12Z1",
    name: "Aditya Birla Sun Life Banking & PSU Debt Fund - Direct Plan - Growth",
    instrumentKind: "mutual_fund",
    quoteCurrency: "INR",
    timezone: "Asia/Kolkata",
    isActive: true,
    lastSuccessfulRefreshAt: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("MarketInstrumentLinkPanel", () => {
  it("renders nothing for asset kinds with no market-data concept", () => {
    const { container } = render(
      <MarketInstrumentLinkPanel
        asset={asset({ assetKind: "ppf" })}
        linkedInstrument={null}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the linked instrument with change/unlink actions when already linked", () => {
    render(
      <MarketInstrumentLinkPanel
        asset={asset({ marketInstrumentId: "instrument-1" })}
        linkedInstrument={instrument({})}
      />,
    );

    expect(
      screen.getByText(
        "Aditya Birla Sun Life Banking & PSU Debt Fund - Direct Plan - Growth",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Change link" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Unlink/ })).toBeInTheDocument();
  });

  it("shows a search box immediately for an unlinked asset", () => {
    render(
      <MarketInstrumentLinkPanel asset={asset({})} linkedInstrument={null} />,
    );

    expect(
      screen.getByLabelText(/Search AMFI schemes by name, code, or ISIN/),
    ).toBeInTheDocument();
  });

  it("searches after typing and shows results with a Link action", async () => {
    const user = userEvent.setup();
    searchMarketInstrumentsActionMock.mockResolvedValue({
      status: "success",
      results: [instrument({})],
    });

    render(
      <MarketInstrumentLinkPanel asset={asset({})} linkedInstrument={null} />,
    );
    await user.type(
      screen.getByLabelText(/Search AMFI schemes/),
      "Aditya Birla",
    );

    await waitFor(() =>
      expect(searchMarketInstrumentsActionMock).toHaveBeenCalledWith(
        "Aditya Birla",
        "mutual_fund",
      ),
    );

    expect(
      await screen.findByRole("button", { name: "Link" }),
    ).toBeInTheDocument();
  });

  it("requires explicit confirmation before saving a first-time link", async () => {
    const user = userEvent.setup();
    searchMarketInstrumentsActionMock.mockResolvedValue({
      status: "success",
      results: [instrument({})],
    });
    linkMarketInstrumentActionMock.mockResolvedValue({
      status: "success",
      message: "Linked to market data.",
    });

    render(
      <MarketInstrumentLinkPanel asset={asset({})} linkedInstrument={null} />,
    );
    await user.type(screen.getByLabelText(/Search AMFI schemes/), "Aditya");
    await user.click(await screen.findByRole("button", { name: "Link" }));

    expect(
      screen.getByRole("heading", {
        name: "Link this investment to market data?",
      }),
    ).toBeInTheDocument();
    expect(linkMarketInstrumentActionMock).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Link" }));

    await waitFor(() =>
      expect(linkMarketInstrumentActionMock).toHaveBeenCalled(),
    );
    const formData = linkMarketInstrumentActionMock.mock
      .calls[0]?.[1] as FormData;
    expect(formData.get("confirmRemap")).toBe("false");
  });

  it("warns about replacing the existing link when the asset is already linked", async () => {
    const user = userEvent.setup();
    searchMarketInstrumentsActionMock.mockResolvedValue({
      status: "success",
      results: [instrument({ id: "instrument-2", name: "A Different Fund" })],
    });

    render(
      <MarketInstrumentLinkPanel
        asset={asset({ marketInstrumentId: "instrument-1" })}
        linkedInstrument={instrument({})}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Change link" }));
    await user.type(screen.getByLabelText(/Search AMFI schemes/), "Different");
    await user.click(await screen.findByRole("button", { name: "Link" }));

    expect(
      screen.getByRole("heading", {
        name: "Replace the existing market data link?",
      }),
    ).toBeInTheDocument();
  });
});
