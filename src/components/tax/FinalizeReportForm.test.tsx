import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { assertDefined } from "@/test/assert";
import type { finalizeTaxReportSnapshotAction } from "@/lib/tax/actions";

const finalizeTaxReportSnapshotActionMock =
  vi.fn<typeof finalizeTaxReportSnapshotAction>();
vi.mock("@/lib/tax/actions", () => ({
  finalizeTaxReportSnapshotAction: (
    ...args: Parameters<typeof finalizeTaxReportSnapshotAction>
  ) => finalizeTaxReportSnapshotActionMock(...args),
}));

import { FinalizeReportForm } from "@/components/tax/FinalizeReportForm";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("FinalizeReportForm — confirmation dialog", () => {
  it("keeps the confirmation closed until the trigger is clicked", () => {
    render(
      <FinalizeReportForm snapshotId="snap-1" financialYearId="2025-26" />,
    );
    expect(screen.queryByText("Finalize this report?")).not.toBeInTheDocument();
  });

  it("opens the dialog and states that finalizing becomes immutable and is never a submission anywhere", async () => {
    const user = userEvent.setup();
    render(
      <FinalizeReportForm snapshotId="snap-1" financialYearId="2025-26" />,
    );

    await user.click(
      screen.getByRole("button", { name: "Finalize this report" }),
    );

    expect(screen.getByText("Finalize this report?")).toBeInTheDocument();
    expect(
      screen.getByText(/becomes immutable — its figures can never be edited/),
    ).toBeInTheDocument();
    expect(screen.getByText(/never submitted anywhere/)).toBeInTheDocument();
  });

  it("closes without finalizing when Cancel is clicked", async () => {
    const user = userEvent.setup();
    render(
      <FinalizeReportForm snapshotId="snap-1" financialYearId="2025-26" />,
    );

    await user.click(
      screen.getByRole("button", { name: "Finalize this report" }),
    );
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByText("Finalize this report?")).not.toBeInTheDocument();
    expect(finalizeTaxReportSnapshotActionMock).not.toHaveBeenCalled();
  });

  it("submits the exact snapshot id and financial year on confirm", async () => {
    finalizeTaxReportSnapshotActionMock.mockResolvedValue({
      status: "success",
      message: "Report finalized.",
    });
    const user = userEvent.setup();
    render(
      <FinalizeReportForm snapshotId="snap-42" financialYearId="2025-26" />,
    );

    await user.click(
      screen.getByRole("button", { name: "Finalize this report" }),
    );
    await user.click(screen.getByRole("button", { name: "Finalize" }));

    expect(finalizeTaxReportSnapshotActionMock).toHaveBeenCalledTimes(1);
    const [, formData] = assertDefined(
      finalizeTaxReportSnapshotActionMock.mock.calls[0],
    );
    expect(formData.get("snapshotId")).toBe("snap-42");
    expect(formData.get("financialYearId")).toBe("2025-26");
  });

  it("shows a finalization-failure message inside the dialog rather than silently closing", async () => {
    finalizeTaxReportSnapshotActionMock.mockResolvedValue({
      status: "error",
      message: "This snapshot could not be finalized.",
    });
    const user = userEvent.setup();
    render(
      <FinalizeReportForm snapshotId="snap-1" financialYearId="2025-26" />,
    );

    await user.click(
      screen.getByRole("button", { name: "Finalize this report" }),
    );
    await user.click(screen.getByRole("button", { name: "Finalize" }));

    expect(
      await screen.findByText("This snapshot could not be finalized."),
    ).toBeInTheDocument();
  });
});
