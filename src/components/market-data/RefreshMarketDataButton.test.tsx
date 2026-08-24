import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { runMarketDataRefreshSelfAction } from "@/lib/market-data/actions";

const runMarketDataRefreshSelfActionMock =
  vi.fn<typeof runMarketDataRefreshSelfAction>();
vi.mock("@/lib/market-data/actions", () => ({
  runMarketDataRefreshSelfAction: () => runMarketDataRefreshSelfActionMock(),
}));

const refreshMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

import { RefreshMarketDataButton } from "@/components/market-data/RefreshMarketDataButton";

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("RefreshMarketDataButton", () => {
  it("shows a queued message and starts a cooldown countdown when the refresh is accepted", async () => {
    const user = userEvent.setup({ delay: null });
    runMarketDataRefreshSelfActionMock.mockResolvedValue({
      status: "success",
      queued: true,
      retryAfterSeconds: 900,
      instrumentsRequested: 3,
    });

    render(<RefreshMarketDataButton />);
    await user.click(
      screen.getByRole("button", { name: /Refresh my linked holdings/ }),
    );

    expect(
      await screen.findByText(/Refresh queued for 3 linked holdings/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Refresh available in 900s/ }),
    ).toBeDisabled();
    expect(refreshMock).toHaveBeenCalled();
  });

  it("shows the exact server-reported wait time when still in cooldown, never a guessed duration", async () => {
    const user = userEvent.setup({ delay: null });
    runMarketDataRefreshSelfActionMock.mockResolvedValue({
      status: "success",
      queued: false,
      retryAfterSeconds: 42,
      instrumentsRequested: 0,
    });

    render(<RefreshMarketDataButton />);
    await user.click(
      screen.getByRole("button", { name: /Refresh my linked holdings/ }),
    );

    expect(await screen.findByText(/try again in 42s/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Refresh available in 42s/ }),
    ).toBeDisabled();
  });

  it("shows the error message and leaves the button enabled when the action fails", async () => {
    const user = userEvent.setup({ delay: null });
    runMarketDataRefreshSelfActionMock.mockResolvedValue({
      status: "error",
      message: "You need to sign in again to manage market data.",
    });

    render(<RefreshMarketDataButton />);
    await user.click(
      screen.getByRole("button", { name: /Refresh my linked holdings/ }),
    );

    expect(
      await screen.findByText(
        "You need to sign in again to manage market data.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Refresh my linked holdings/ }),
    ).not.toBeDisabled();
  });
});
