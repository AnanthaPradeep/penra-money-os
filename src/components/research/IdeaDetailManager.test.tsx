import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { updateInvestmentIdeaAction as UpdateInvestmentIdeaAction } from "@/lib/research/actions";
import type {
  InvestmentIdea,
  InvestmentThesis,
  ResearchReviewEvent,
} from "@/lib/research/mapping";

const updateInvestmentIdeaActionMock =
  vi.fn<typeof UpdateInvestmentIdeaAction>();
vi.mock("@/lib/research/actions", () => ({
  updateInvestmentIdeaAction: (
    ...args: Parameters<typeof UpdateInvestmentIdeaAction>
  ) => updateInvestmentIdeaActionMock(...args),
}));

const refreshMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

import { IdeaDetailManager } from "@/components/research/IdeaDetailManager";

function idea(overrides: Partial<InvestmentIdea>): InvestmentIdea {
  return {
    id: "idea-1",
    userId: "user-1",
    instrumentId: "instrument-1",
    thesisId: null,
    title: "Margin recovery play",
    status: "researching",
    priority: "medium",
    origin: null,
    rationale: null,
    riskNotes: null,
    nextReviewDate: null,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

function thesis(overrides: Partial<InvestmentThesis>): InvestmentThesis {
  return {
    id: "thesis-1",
    userId: "user-1",
    instrumentId: "instrument-1",
    title: "Long-term compounder",
    summary: null,
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

function event(overrides: Partial<ResearchReviewEvent>): ResearchReviewEvent {
  return {
    id: "event-1",
    userId: "user-1",
    instrumentId: "instrument-1",
    eventType: "idea_created",
    relatedTable: "investment_ideas",
    relatedId: "idea-1",
    summary: "Idea captured",
    occurredAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("IdeaDetailManager", () => {
  it("shows the idea's title, status, priority, and company link", () => {
    render(
      <IdeaDetailManager
        idea={idea({})}
        companyName="Tata Consultancy Services"
        instrumentId="instrument-1"
        linkedThesis={null}
        currentThesisForCompany={null}
        reviewEvents={[]}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Margin recovery play" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Tata Consultancy Services" }),
    ).toHaveAttribute("href", "/app/research/companies/instrument-1");
  });

  it("shows a no-trade disclosure only when approved for manual action", () => {
    const { rerender } = render(
      <IdeaDetailManager
        idea={idea({})}
        companyName="Tata Consultancy Services"
        instrumentId="instrument-1"
        linkedThesis={null}
        currentThesisForCompany={null}
        reviewEvents={[]}
      />,
    );
    expect(
      screen.queryByText(/has not placed any trade/),
    ).not.toBeInTheDocument();

    rerender(
      <IdeaDetailManager
        idea={idea({ status: "approved_for_manual_action" })}
        companyName="Tata Consultancy Services"
        instrumentId="instrument-1"
        linkedThesis={null}
        currentThesisForCompany={null}
        reviewEvents={[]}
      />,
    );
    expect(screen.getByText(/has not placed any trade/)).toBeInTheDocument();
  });

  it("offers to link the company's current thesis when none is linked yet", async () => {
    updateInvestmentIdeaActionMock.mockResolvedValue({
      status: "success",
      message: "Idea updated.",
    });
    const user = userEvent.setup();
    render(
      <IdeaDetailManager
        idea={idea({})}
        companyName="Tata Consultancy Services"
        instrumentId="instrument-1"
        linkedThesis={null}
        currentThesisForCompany={thesis({})}
        reviewEvents={[]}
      />,
    );

    await user.click(
      screen.getByRole("button", {
        name: "Link this company's current thesis",
      }),
    );

    await waitFor(() =>
      expect(updateInvestmentIdeaActionMock).toHaveBeenCalled(),
    );
    const formData = updateInvestmentIdeaActionMock.mock.calls[0]?.[1];
    expect(formData?.get("thesisId")).toBe("thesis-1");
  });

  it("shows the linked thesis title once linked, with no link-offer button", () => {
    render(
      <IdeaDetailManager
        idea={idea({ thesisId: "thesis-1" })}
        companyName="Tata Consultancy Services"
        instrumentId="instrument-1"
        linkedThesis={thesis({})}
        currentThesisForCompany={thesis({})}
        reviewEvents={[]}
      />,
    );

    expect(
      screen.getByRole("link", { name: "Long-term compounder" }),
    ).toHaveAttribute("href", "/app/research/companies/instrument-1/thesis");
    expect(
      screen.queryByRole("button", {
        name: "Link this company's current thesis",
      }),
    ).not.toBeInTheDocument();
  });

  it("shows the decision log", () => {
    render(
      <IdeaDetailManager
        idea={idea({})}
        companyName="Tata Consultancy Services"
        instrumentId="instrument-1"
        linkedThesis={null}
        currentThesisForCompany={null}
        reviewEvents={[event({})]}
      />,
    );

    expect(screen.getByText("Idea captured")).toBeInTheDocument();
  });

  it("edits the idea and changes its status", async () => {
    updateInvestmentIdeaActionMock.mockResolvedValue({
      status: "success",
      message: "Idea updated.",
    });
    const user = userEvent.setup();
    render(
      <IdeaDetailManager
        idea={idea({})}
        companyName="Tata Consultancy Services"
        instrumentId="instrument-1"
        linkedThesis={null}
        currentThesisForCompany={null}
        reviewEvents={[]}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.selectOptions(
      screen.getByLabelText("Status"),
      "approved_for_manual_action",
    );
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(updateInvestmentIdeaActionMock).toHaveBeenCalled(),
    );
    const formData = updateInvestmentIdeaActionMock.mock.calls[0]?.[1];
    expect(formData?.get("ideaId")).toBe("idea-1");
    expect(formData?.get("status")).toBe("approved_for_manual_action");
  });
});
