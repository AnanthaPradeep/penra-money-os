import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { setRecurringItemStatusAction as SetRecurringItemStatusAction } from "@/lib/recurring/actions";

const refreshMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

const setRecurringItemStatusAction =
  vi.fn<typeof SetRecurringItemStatusAction>();
vi.mock("@/lib/recurring/actions", () => ({
  setRecurringItemStatusAction: (
    ...args: Parameters<typeof SetRecurringItemStatusAction>
  ) => setRecurringItemStatusAction(...args),
}));

import { RecurringItemActions } from "@/components/recurring/RecurringItemActions";

function firstFormData(): FormData {
  const call = setRecurringItemStatusAction.mock.calls[0];
  if (!call) {
    throw new Error("setRecurringItemStatusAction was not called");
  }
  return call[1];
}

describe("RecurringItemActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows Pause and Cancel for an active item, but not Resume or Archive", () => {
    render(<RecurringItemActions recurringItemId="item-1" status="active" />);

    expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Resume" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Archive" }),
    ).not.toBeInTheDocument();
  });

  it("shows Resume and Cancel for a paused item, but not Pause", () => {
    render(<RecurringItemActions recurringItemId="item-1" status="paused" />);

    expect(screen.getByRole("button", { name: "Resume" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Pause" }),
    ).not.toBeInTheDocument();
  });

  it("shows only Archive for a cancelled item", () => {
    render(
      <RecurringItemActions recurringItemId="item-1" status="cancelled" />,
    );

    expect(screen.getByRole("button", { name: "Archive" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Cancel" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Pause" }),
    ).not.toBeInTheDocument();
  });

  it("renders nothing for an archived item", () => {
    const { container } = render(
      <RecurringItemActions recurringItemId="item-1" status="archived" />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("pauses an active item directly (no confirmation needed) and refreshes", async () => {
    setRecurringItemStatusAction.mockResolvedValue({
      status: "success",
      message: "Done",
    });
    const user = userEvent.setup();
    render(<RecurringItemActions recurringItemId="item-1" status="active" />);

    await user.click(screen.getByRole("button", { name: "Pause" }));

    await waitFor(() =>
      expect(setRecurringItemStatusAction).toHaveBeenCalled(),
    );
    const formData = firstFormData();
    expect(formData.get("recurringItemId")).toBe("item-1");
    expect(formData.get("status")).toBe("paused");
    await waitFor(() => expect(refreshMock).toHaveBeenCalled());
  });

  it("requires confirmation before cancelling, then submits the cancelled status", async () => {
    setRecurringItemStatusAction.mockResolvedValue({
      status: "success",
      message: "Done",
    });
    const user = userEvent.setup();
    render(<RecurringItemActions recurringItemId="item-1" status="active" />);

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(setRecurringItemStatusAction).not.toHaveBeenCalled();

    await user.click(
      screen.getByRole("button", { name: "Cancel recurring item" }),
    );

    await waitFor(() =>
      expect(setRecurringItemStatusAction).toHaveBeenCalled(),
    );
    const formData = firstFormData();
    expect(formData.get("status")).toBe("cancelled");
  });
});
