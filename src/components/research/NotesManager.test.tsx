import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  createResearchNoteAction as CreateResearchNoteAction,
  updateResearchNoteAction as UpdateResearchNoteAction,
} from "@/lib/research/actions";
import type { ResearchNote } from "@/lib/research/mapping";

const createResearchNoteActionMock = vi.fn<typeof CreateResearchNoteAction>();
const updateResearchNoteActionMock = vi.fn<typeof UpdateResearchNoteAction>();
vi.mock("@/lib/research/actions", () => ({
  createResearchNoteAction: (
    ...args: Parameters<typeof CreateResearchNoteAction>
  ) => createResearchNoteActionMock(...args),
  updateResearchNoteAction: (
    ...args: Parameters<typeof UpdateResearchNoteAction>
  ) => updateResearchNoteActionMock(...args),
}));

const refreshMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

import { NotesManager } from "@/components/research/NotesManager";

function note(overrides: Partial<ResearchNote>): ResearchNote {
  return {
    id: "note-1",
    userId: "user-1",
    instrumentId: "instrument-1",
    title: "Q1 earnings call",
    body: "Management guided for margin expansion next quarter.",
    noteType: "financial_result",
    sourceUrl: null,
    filingId: null,
    observedDate: null,
    isPinned: false,
    isArchived: false,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("NotesManager", () => {
  it("shows an empty state with no notes", () => {
    render(<NotesManager instrumentId="instrument-1" notes={[]} />);
    expect(screen.getByText("No notes yet.")).toBeInTheDocument();
  });

  it("lists active notes and hides archived ones by default", () => {
    render(
      <NotesManager
        instrumentId="instrument-1"
        notes={[note({}), note({ id: "note-2", isArchived: true })]}
      />,
    );

    expect(screen.getByText("Q1 earnings call")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Show archived notes" }),
    ).toBeInTheDocument();
  });

  it("creates a note and refreshes on success", async () => {
    createResearchNoteActionMock.mockResolvedValue({
      status: "success",
      message: "Note saved.",
      id: "note-new",
    });
    const user = userEvent.setup();
    render(<NotesManager instrumentId="instrument-1" notes={[]} />);

    await user.click(screen.getByRole("button", { name: "New note" }));
    await user.type(screen.getByLabelText("Title"), "Management change");
    await user.type(
      screen.getByLabelText("Content"),
      "New CFO announced today.",
    );
    await user.click(screen.getByRole("button", { name: "Create note" }));

    await waitFor(() =>
      expect(createResearchNoteActionMock).toHaveBeenCalled(),
    );
    const formData = createResearchNoteActionMock.mock.calls[0]?.[1];
    expect(formData?.get("instrumentId")).toBe("instrument-1");
    expect(formData?.get("title")).toBe("Management change");
    await waitFor(() => expect(refreshMock).toHaveBeenCalled());
  });

  it("toggles pinned state without opening the edit dialog", async () => {
    updateResearchNoteActionMock.mockResolvedValue({
      status: "success",
      message: "Note updated.",
    });
    const user = userEvent.setup();
    render(<NotesManager instrumentId="instrument-1" notes={[note({})]} />);

    await user.click(screen.getByRole("button", { name: "Pin note" }));

    await waitFor(() =>
      expect(updateResearchNoteActionMock).toHaveBeenCalled(),
    );
    const formData = updateResearchNoteActionMock.mock.calls[0]?.[1];
    expect(formData?.get("noteId")).toBe("note-1");
    expect(formData?.get("isPinned")).toBe("true");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("archives a note", async () => {
    updateResearchNoteActionMock.mockResolvedValue({
      status: "success",
      message: "Note updated.",
    });
    const user = userEvent.setup();
    render(<NotesManager instrumentId="instrument-1" notes={[note({})]} />);

    await user.click(screen.getByRole("button", { name: "Archive note" }));

    await waitFor(() =>
      expect(updateResearchNoteActionMock).toHaveBeenCalled(),
    );
    const formData = updateResearchNoteActionMock.mock.calls[0]?.[1];
    expect(formData?.get("isArchived")).toBe("true");
  });
});
