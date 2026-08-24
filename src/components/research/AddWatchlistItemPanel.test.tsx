import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { addWatchlistItemAction as AddWatchlistItemAction } from "@/lib/research/actions";
import type { searchMarketInstrumentsAction as SearchMarketInstrumentsAction } from "@/lib/market-data/actions";
import type { MarketInstrument } from "@/lib/market-data/mapping";

const addWatchlistItemActionMock = vi.fn<typeof AddWatchlistItemAction>();
vi.mock("@/lib/research/actions", () => ({
  addWatchlistItemAction: (
    ...args: Parameters<typeof AddWatchlistItemAction>
  ) => addWatchlistItemActionMock(...args),
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

import { AddWatchlistItemPanel } from "@/components/research/AddWatchlistItemPanel";

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

beforeEach(() => {
  vi.clearAllMocks();
});

describe("AddWatchlistItemPanel", () => {
  it("searches only stock instruments, never mutual funds", async () => {
    const user = userEvent.setup();
    searchMarketInstrumentsActionMock.mockResolvedValue({
      status: "success",
      results: [instrument({})],
    });
    render(
      <AddWatchlistItemPanel watchlistId="wl-1" existingInstrumentIds={[]} />,
    );

    await user.type(screen.getByLabelText(/Search stocks/), "TCS");

    await waitFor(() =>
      expect(searchMarketInstrumentsActionMock).toHaveBeenCalledWith(
        "TCS",
        "stock",
      ),
    );
    expect(
      await screen.findByRole("button", { name: "Add" }),
    ).toBeInTheDocument();
  });

  it("adds the selected company to the watchlist and refreshes", async () => {
    const user = userEvent.setup();
    searchMarketInstrumentsActionMock.mockResolvedValue({
      status: "success",
      results: [instrument({})],
    });
    addWatchlistItemActionMock.mockResolvedValue({
      status: "success",
      message: "Added to watchlist.",
    });
    render(
      <AddWatchlistItemPanel watchlistId="wl-1" existingInstrumentIds={[]} />,
    );

    await user.type(screen.getByLabelText(/Search stocks/), "TCS");
    await user.click(await screen.findByRole("button", { name: "Add" }));

    await waitFor(() => expect(addWatchlistItemActionMock).toHaveBeenCalled());
    const formData = addWatchlistItemActionMock.mock.calls[0]?.[1];
    expect(formData?.get("watchlistId")).toBe("wl-1");
    expect(formData?.get("instrumentId")).toBe("instrument-1");
    await waitFor(() => expect(refreshMock).toHaveBeenCalled());
  });

  it("disables Add and labels it Added for a company already on the list", async () => {
    const user = userEvent.setup();
    searchMarketInstrumentsActionMock.mockResolvedValue({
      status: "success",
      results: [instrument({})],
    });
    render(
      <AddWatchlistItemPanel
        watchlistId="wl-1"
        existingInstrumentIds={["instrument-1"]}
      />,
    );

    await user.type(screen.getByLabelText(/Search stocks/), "TCS");

    const addedButton = await screen.findByRole("button", { name: "Added" });
    expect(addedButton).toBeDisabled();
    expect(addWatchlistItemActionMock).not.toHaveBeenCalled();
  });
});
