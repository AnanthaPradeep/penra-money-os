import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { assertDefined } from "@/test/assert";
import type { generateTaxReportSnapshotAction } from "@/lib/tax/actions";

const generateTaxReportSnapshotActionMock =
  vi.fn<typeof generateTaxReportSnapshotAction>();
vi.mock("@/lib/tax/actions", () => ({
  generateTaxReportSnapshotAction: (
    ...args: Parameters<typeof generateTaxReportSnapshotAction>
  ) => generateTaxReportSnapshotActionMock(...args),
}));

import { GenerateReportForm } from "@/components/tax/GenerateReportForm";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GenerateReportForm", () => {
  it("submits a draft-generation request scoped to the given financial year", async () => {
    generateTaxReportSnapshotActionMock.mockResolvedValue({
      status: "success",
      message: "Draft report generated.",
    });
    const user = userEvent.setup();
    render(<GenerateReportForm financialYearId="2025-26" />);

    await user.click(
      screen.getByRole("button", { name: "Generate draft report" }),
    );

    expect(generateTaxReportSnapshotActionMock).toHaveBeenCalledTimes(1);
    const [, formData] = assertDefined(
      generateTaxReportSnapshotActionMock.mock.calls[0],
    );
    expect(formData.get("financialYearId")).toBe("2025-26");
  });

  it("shows the generated draft's warnings on success", async () => {
    generateTaxReportSnapshotActionMock.mockResolvedValue({
      status: "success",
      message: "Draft report generated with 2 warning(s).",
    });
    const user = userEvent.setup();
    render(<GenerateReportForm financialYearId="2025-26" />);

    await user.click(
      screen.getByRole("button", { name: "Generate draft report" }),
    );

    expect(
      await screen.findByText("Draft report generated with 2 warning(s)."),
    ).toBeInTheDocument();
  });

  it("shows a generation-failure message rather than silently doing nothing", async () => {
    generateTaxReportSnapshotActionMock.mockResolvedValue({
      status: "error",
      message: "Could not generate a report right now.",
    });
    const user = userEvent.setup();
    render(<GenerateReportForm financialYearId="2025-26" />);

    await user.click(
      screen.getByRole("button", { name: "Generate draft report" }),
    );

    expect(
      await screen.findByText("Could not generate a report right now."),
    ).toBeInTheDocument();
  });
});
