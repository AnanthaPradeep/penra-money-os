import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  removeWatchlistItemAction as RemoveWatchlistItemAction,
  updateWatchlistItemAction as UpdateWatchlistItemAction,
} from "@/lib/research/actions";
import type { MarketInstrument } from "@/lib/market-data/mapping";
import type { WatchlistItem } from "@/lib/research/mapping";

const updateWatchlistItemActionMock = vi.fn<typeof UpdateWatchlistItemAction>();
const removeWatchlistItemActionMock = vi.fn<typeof RemoveWatchlistItemAction>();
vi.mock("@/lib/research/actions", () => ({
  updateWatchlistItemAction: (
    ...args: Parameters<typeof UpdateWatchlistItemAction>
  ) => updateWatchlistItemActionMock(...args),
  removeWatchlistItemAction: (
    ...args: Parameters<typeof RemoveWatchlistItemAction>
  ) => removeWatchlistItemActionMock(...args),
}));

const refreshMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

import { WatchlistItemRow } from "@/components/research/WatchlistItemRow";

function item(overrides: Partial<WatchlistItem>): WatchlistItem {
  return {
    id: "item-1",
    watchlistId: "wl-1",
    userId: "user-1",
    instrumentId: "instrument-1",
    addedAt: "2026-08-01T00:00:00.000Z",
    priority: "medium",
    targetReviewDate: null,
    researchStatus: "unreviewed",
    sortOrder: 0,
    ...overrides,
  };
}

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

describe("WatchlistItemRow", () => {
  it("shows the company name and research status", () => {
    render(
      <WatchlistItemRow
        item={item({})}
        instrument={instrument({})}
        isOwned={false}
      />,
    );

    expect(screen.getByText("Tata Consultancy Services")).toBeInTheDocument();
    expect(
      screen.getByText("Unreviewed", { selector: "span" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Owned")).not.toBeInTheDocument();
  });

  it("shows an Owned badge when the company is also a real holding", () => {
    render(
      <WatchlistItemRow
        item={item({})}
        instrument={instrument({})}
        isOwned={true}
      />,
    );

    expect(screen.getByText("Owned")).toBeInTheDocument();
  });

  it("links to the company research page, never to a trading/order screen", () => {
    render(
      <WatchlistItemRow
        item={item({})}
        instrument={instrument({})}
        isOwned={false}
      />,
    );

    expect(
      screen.getByRole("link", { name: "Tata Consultancy Services" }),
    ).toHaveAttribute("href", "/app/research/companies/instrument-1");
  });

  it("updates research status and refreshes", async () => {
    updateWatchlistItemActionMock.mockResolvedValue({
      status: "success",
      message: "Updated.",
    });
    const user = userEvent.setup();
    render(
      <WatchlistItemRow
        item={item({})}
        instrument={instrument({})}
        isOwned={false}
      />,
    );

    await user.selectOptions(
      screen.getByLabelText("Research status"),
      "watching",
    );

    await waitFor(() =>
      expect(updateWatchlistItemActionMock).toHaveBeenCalled(),
    );
    const formData = updateWatchlistItemActionMock.mock.calls[0]?.[1];
    expect(formData?.get("itemId")).toBe("item-1");
    expect(formData?.get("researchStatus")).toBe("watching");
    await waitFor(() => expect(refreshMock).toHaveBeenCalled());
  });

  it("requires confirmation before removing from the watchlist", async () => {
    removeWatchlistItemActionMock.mockResolvedValue({
      status: "success",
      message: "Removed from watchlist.",
    });
    const user = userEvent.setup();
    render(
      <WatchlistItemRow
        item={item({})}
        instrument={instrument({})}
        isOwned={false}
      />,
    );

    await user.click(
      screen.getByRole("button", {
        name: "Remove Tata Consultancy Services from watchlist",
      }),
    );
    expect(removeWatchlistItemActionMock).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Remove" }));

    await waitFor(() =>
      expect(removeWatchlistItemActionMock).toHaveBeenCalled(),
    );
    const formData = removeWatchlistItemActionMock.mock.calls[0]?.[1];
    expect(formData?.get("itemId")).toBe("item-1");
  });
});
