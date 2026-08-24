import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  createWatchlistAction as CreateWatchlistAction,
  setWatchlistArchivedAction as SetWatchlistArchivedAction,
} from "@/lib/research/actions";
import type { Watchlist } from "@/lib/research/mapping";

const createWatchlistActionMock = vi.fn<typeof CreateWatchlistAction>();
const setWatchlistArchivedActionMock =
  vi.fn<typeof SetWatchlistArchivedAction>();
vi.mock("@/lib/research/actions", () => ({
  createWatchlistAction: (...args: Parameters<typeof CreateWatchlistAction>) =>
    createWatchlistActionMock(...args),
  setWatchlistArchivedAction: (
    ...args: Parameters<typeof SetWatchlistArchivedAction>
  ) => setWatchlistArchivedActionMock(...args),
}));

const refreshMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

import { WatchlistsManager } from "@/components/research/WatchlistsManager";

function watchlist(overrides: Partial<Watchlist>): Watchlist {
  return {
    id: "wl-1",
    userId: "user-1",
    name: "Compounders",
    description: null,
    color: "slate",
    icon: "star",
    sortOrder: 0,
    status: "active",
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("WatchlistsManager", () => {
  it("shows an onboarding empty state with no watchlists", () => {
    render(<WatchlistsManager watchlists={[]} itemCounts={{}} />);

    expect(screen.getByText("Create your first watchlist")).toBeInTheDocument();
  });

  it("shows each active watchlist with its item count", () => {
    render(
      <WatchlistsManager
        watchlists={[watchlist({})]}
        itemCounts={{ "wl-1": 3 }}
      />,
    );

    expect(screen.getByText("Compounders")).toBeInTheDocument();
    expect(screen.getByText("3 companies")).toBeInTheDocument();
  });

  it("creates a watchlist and refreshes on success", async () => {
    createWatchlistActionMock.mockResolvedValue({
      status: "success",
      message: "Watchlist created.",
      id: "wl-new",
    });
    const user = userEvent.setup();
    render(<WatchlistsManager watchlists={[]} itemCounts={{}} />);

    await user.click(
      screen.getAllByRole("button", { name: "New watchlist" })[0]!,
    );
    await user.type(screen.getByLabelText("Name"), "Deep value");
    await user.click(screen.getByRole("button", { name: "Create watchlist" }));

    await waitFor(() => expect(createWatchlistActionMock).toHaveBeenCalled());
    const formData = createWatchlistActionMock.mock.calls[0]?.[1];
    expect(formData?.get("name")).toBe("Deep value");
    await waitFor(() => expect(refreshMock).toHaveBeenCalled());
  });

  it("archives an active watchlist through the confirm dialog", async () => {
    setWatchlistArchivedActionMock.mockResolvedValue({
      status: "success",
      message: "Watchlist updated.",
    });
    const user = userEvent.setup();
    render(<WatchlistsManager watchlists={[watchlist({})]} itemCounts={{}} />);

    await user.click(screen.getByRole("button", { name: /Archive/ }));
    await user.click(screen.getByRole("button", { name: "Archive watchlist" }));

    await waitFor(() =>
      expect(setWatchlistArchivedActionMock).toHaveBeenCalled(),
    );
    const formData = setWatchlistArchivedActionMock.mock.calls[0]?.[1];
    expect(formData?.get("watchlistId")).toBe("wl-1");
    expect(formData?.get("status")).toBe("archived");
  });

  it("shows a restore action for an archived watchlist", () => {
    render(
      <WatchlistsManager
        watchlists={[watchlist({ status: "archived" })]}
        itemCounts={{}}
      />,
    );

    expect(screen.getByRole("button", { name: /Restore/ })).toBeInTheDocument();
  });
});
