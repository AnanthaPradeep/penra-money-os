import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  createInvestmentThesisAction as CreateInvestmentThesisAction,
  updateInvestmentThesisAction as UpdateInvestmentThesisAction,
} from "@/lib/research/actions";
import type {
  InvestmentThesis,
  InvestmentThesisVersion,
} from "@/lib/research/mapping";

const createInvestmentThesisActionMock =
  vi.fn<typeof CreateInvestmentThesisAction>();
const updateInvestmentThesisActionMock =
  vi.fn<typeof UpdateInvestmentThesisAction>();
vi.mock("@/lib/research/actions", () => ({
  createInvestmentThesisAction: (
    ...args: Parameters<typeof CreateInvestmentThesisAction>
  ) => createInvestmentThesisActionMock(...args),
  updateInvestmentThesisAction: (
    ...args: Parameters<typeof UpdateInvestmentThesisAction>
  ) => updateInvestmentThesisActionMock(...args),
}));

const refreshMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

import { ThesisManager } from "@/components/research/ThesisManager";

function thesis(overrides: Partial<InvestmentThesis>): InvestmentThesis {
  return {
    id: "thesis-1",
    userId: "user-1",
    instrumentId: "instrument-1",
    title: "Long-term compounder",
    summary: "Durable moat, reinvests at high returns.",
    investmentCase: null,
    opportunities: null,
    risks: null,
    catalysts: null,
    invalidationConditions: null,
    expectedReviewDate: null,
    timeHorizon: "long_term",
    confidence: "medium",
    status: "active",
    currentVersion: 1,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function version(
  overrides: Partial<InvestmentThesisVersion>,
): InvestmentThesisVersion {
  return {
    id: "version-1",
    thesisId: "thesis-1",
    version: 1,
    title: "Long-term compounder",
    summary: null,
    investmentCase: null,
    opportunities: null,
    risks: null,
    catalysts: null,
    invalidationConditions: null,
    timeHorizon: "long_term",
    confidence: "medium",
    status: "active",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ThesisManager", () => {
  it("shows an empty state with a create prompt when there is no thesis", () => {
    render(
      <ThesisManager instrumentId="instrument-1" thesis={null} versions={[]} />,
    );

    expect(screen.getByText("No thesis yet")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Create thesis" }),
    ).toBeInTheDocument();
  });

  it("creates a thesis for the company", async () => {
    createInvestmentThesisActionMock.mockResolvedValue({
      status: "success",
      message: "Thesis created.",
      id: "thesis-new",
    });
    const user = userEvent.setup();
    render(
      <ThesisManager instrumentId="instrument-1" thesis={null} versions={[]} />,
    );

    await user.click(screen.getByRole("button", { name: "Create thesis" }));
    await user.type(screen.getByLabelText("Title"), "Margin recovery");
    await user.click(screen.getByRole("button", { name: "Create thesis" }));

    await waitFor(() =>
      expect(createInvestmentThesisActionMock).toHaveBeenCalled(),
    );
    const formData = createInvestmentThesisActionMock.mock.calls[0]?.[1];
    expect(formData?.get("instrumentId")).toBe("instrument-1");
    expect(formData?.get("title")).toBe("Margin recovery");
  });

  it("displays the current thesis's content, status, and version number", () => {
    render(
      <ThesisManager
        instrumentId="instrument-1"
        thesis={thesis({ currentVersion: 2 })}
        versions={[version({ version: 2 })]}
      />,
    );

    expect(screen.getByText("Long-term compounder")).toBeInTheDocument();
    expect(
      screen.getByText("Durable moat, reinvests at high returns."),
    ).toBeInTheDocument();
    expect(screen.getByText(/Version 2/)).toBeInTheDocument();
    expect(
      screen.getByText(/confidence \(a qualitative level, not a probability\)/),
    ).toBeInTheDocument();
  });

  it("shows version history once more than one version exists", () => {
    render(
      <ThesisManager
        instrumentId="instrument-1"
        thesis={thesis({ currentVersion: 2 })}
        versions={[version({ version: 2 }), version({ version: 1 })]}
      />,
    );

    expect(screen.getByText("Version history")).toBeInTheDocument();
    expect(screen.getByText(/Version 1 —/)).toBeInTheDocument();
  });

  it("editing an existing thesis records a new version, never overwriting silently", async () => {
    updateInvestmentThesisActionMock.mockResolvedValue({
      status: "success",
      message: "Thesis updated — a new version was recorded.",
    });
    const user = userEvent.setup();
    render(
      <ThesisManager
        instrumentId="instrument-1"
        thesis={thesis({})}
        versions={[version({})]}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Edit" }));
    expect(
      screen.getByText(/Saving records a brand-new version/),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Save new version" }));

    await waitFor(() =>
      expect(updateInvestmentThesisActionMock).toHaveBeenCalled(),
    );
    const formData = updateInvestmentThesisActionMock.mock.calls[0]?.[1];
    expect(formData?.get("thesisId")).toBe("thesis-1");
  });
});
