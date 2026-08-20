import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { retryFailedOccurrenceAction as RetryFailedOccurrenceAction } from "@/lib/recurring/actions";

const refreshMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

const retryFailedOccurrenceAction = vi.fn<typeof RetryFailedOccurrenceAction>();
vi.mock("@/lib/recurring/actions", () => ({
  retryFailedOccurrenceAction: (
    ...args: Parameters<typeof RetryFailedOccurrenceAction>
  ) => retryFailedOccurrenceAction(...args),
}));

import { RetryOccurrenceButton } from "@/components/recurring/RetryOccurrenceButton";

describe("RetryOccurrenceButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retries the failed occurrence and refreshes on success", async () => {
    retryFailedOccurrenceAction.mockResolvedValue({
      status: "success",
      message: "Done",
    });
    const user = userEvent.setup();
    render(<RetryOccurrenceButton occurrenceId="occ-failed-1" />);

    await user.click(screen.getByRole("button", { name: "Retry" }));

    await waitFor(() => expect(retryFailedOccurrenceAction).toHaveBeenCalled());
    const call = retryFailedOccurrenceAction.mock.calls[0];
    if (!call) {
      throw new Error("retryFailedOccurrenceAction was not called");
    }
    const formData = call[1];
    expect(formData.get("occurrenceId")).toBe("occ-failed-1");
    await waitFor(() => expect(refreshMock).toHaveBeenCalled());
  });

  it("shows an error message and does not refresh when the retry fails again", async () => {
    retryFailedOccurrenceAction.mockResolvedValue({
      status: "error",
      message: "Insufficient balance on the source account",
    });
    const user = userEvent.setup();
    render(<RetryOccurrenceButton occurrenceId="occ-failed-1" />);

    await user.click(screen.getByRole("button", { name: "Retry" }));

    expect(
      await screen.findByText("Insufficient balance on the source account"),
    ).toBeInTheDocument();
    expect(refreshMock).not.toHaveBeenCalled();
  });
});
