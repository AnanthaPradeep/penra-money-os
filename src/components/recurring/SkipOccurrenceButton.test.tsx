import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { skipOccurrenceAction as SkipOccurrenceAction } from "@/lib/recurring/actions";

const refreshMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

const skipOccurrenceAction = vi.fn<typeof SkipOccurrenceAction>();
vi.mock("@/lib/recurring/actions", () => ({
  skipOccurrenceAction: (...args: Parameters<typeof SkipOccurrenceAction>) =>
    skipOccurrenceAction(...args),
}));

import { SkipOccurrenceButton } from "@/components/recurring/SkipOccurrenceButton";

describe("SkipOccurrenceButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires confirmation before skipping — no action call on the initial click", async () => {
    const user = userEvent.setup();
    render(<SkipOccurrenceButton occurrenceId="occ-1" />);

    await user.click(screen.getByRole("button", { name: "Skip" }));

    expect(
      screen.getByRole("dialog", { name: "Skip this occurrence?" }),
    ).toBeInTheDocument();
    expect(skipOccurrenceAction).not.toHaveBeenCalled();
  });

  it("skips the occurrence and refreshes once confirmed", async () => {
    skipOccurrenceAction.mockResolvedValue({
      status: "success",
      message: "Done",
    });
    const user = userEvent.setup();
    render(<SkipOccurrenceButton occurrenceId="occ-1" />);

    await user.click(screen.getByRole("button", { name: "Skip" }));
    await user.click(screen.getByRole("button", { name: "Skip occurrence" }));

    await waitFor(() => expect(skipOccurrenceAction).toHaveBeenCalled());
    const call = skipOccurrenceAction.mock.calls[0];
    if (!call) {
      throw new Error("skipOccurrenceAction was not called");
    }
    const formData = call[1];
    expect(formData.get("occurrenceId")).toBe("occ-1");
    await waitFor(() => expect(refreshMock).toHaveBeenCalled());
  });

  it("does nothing when the confirmation is cancelled", async () => {
    const user = userEvent.setup();
    render(<SkipOccurrenceButton occurrenceId="occ-1" />);

    await user.click(screen.getByRole("button", { name: "Skip" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(skipOccurrenceAction).not.toHaveBeenCalled();
    expect(refreshMock).not.toHaveBeenCalled();
  });
});
