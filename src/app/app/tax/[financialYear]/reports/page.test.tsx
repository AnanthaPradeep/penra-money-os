import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { getAuthenticatedUser } from "@/lib/auth/session";
import type { TaxReportSnapshot } from "@/lib/tax/mapping";
import type { listTaxReportSnapshots } from "@/lib/tax/queries";

const getAuthenticatedUserMock = vi.fn<typeof getAuthenticatedUser>();
vi.mock("@/lib/auth/session", () => ({
  getAuthenticatedUser: (...args: Parameters<typeof getAuthenticatedUser>) =>
    getAuthenticatedUserMock(...args),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(() => Promise.resolve({})),
}));

const listTaxReportSnapshotsMock = vi.fn<typeof listTaxReportSnapshots>();
vi.mock("@/lib/tax/queries", () => ({
  listTaxReportSnapshots: (
    ...args: Parameters<typeof listTaxReportSnapshots>
  ) => listTaxReportSnapshotsMock(...args),
}));

// GenerateReportForm and FinalizeReportForm are real client components that
// import Server Actions from "@/lib/tax/actions" — a "use server" module
// carrying `import "server-only"` at its top, which throws unconditionally
// when actually loaded outside a real Next.js server bundle.
vi.mock("@/lib/tax/actions", () => ({
  generateTaxReportSnapshotAction: vi.fn(),
  finalizeTaxReportSnapshotAction: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw Object.assign(new Error(`NEXT_REDIRECT:${url}`), {
      digest: `NEXT_REDIRECT;push;${url};307;`,
    });
  }),
  notFound: vi.fn(() => {
    throw Object.assign(new Error("NEXT_NOT_FOUND"), {
      digest: "NEXT_NOT_FOUND",
    });
  }),
}));

function snapshot(overrides: Partial<TaxReportSnapshot>): TaxReportSnapshot {
  return {
    id: "snap-1",
    financialYearId: "2025-26",
    assessmentYearId: "2026-27",
    ruleSetVersion: "in-individual-2025-26.v1",
    status: "draft",
    completenessStatus: "partial",
    snapshotData: null,
    warnings: [],
    supersedesSnapshotId: null,
    supersededBy: null,
    generatedAt: "2026-08-27T00:00:00.000Z",
    finalizedAt: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  getAuthenticatedUserMock.mockResolvedValue({
    id: "user-1",
    email: "asha@example.com",
  });
  listTaxReportSnapshotsMock.mockResolvedValue([]);
});

async function renderPage(financialYear = "2025-26") {
  const { default: TaxReportsPage } =
    await import("@/app/app/tax/[financialYear]/reports/page");
  return render(
    await TaxReportsPage({ params: Promise.resolve({ financialYear }) }),
  );
}

describe("TaxReportsPage — empty state", () => {
  // Extended per-test timeout, evidence-based rather than a blanket bump:
  // this is the file's first test, so it alone pays the cold cost of
  // dynamically importing the full page module graph (GenerateReportForm,
  // FinalizeReportForm, and everything under them). Verified directly —
  // run in isolation with this same timeout, the "tests" phase itself
  // completes in ~8.5s, comfortably under 30s but over Vitest's 5s
  // default; every other test in this file (which reuses the now-warm
  // import) finishes well within the default. Not a hang, not app logic —
  // confirmed by observing an actual pass, not by assuming one.
  it("shows a no-report-yet empty state and still offers the generate-draft form", async () => {
    await renderPage();
    expect(screen.getByText("No report generated yet")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Generate draft report" }),
    ).toBeInTheDocument();
  }, 30000);
});

describe("TaxReportsPage — draft snapshot", () => {
  it("shows the draft's rule-set version, completeness, and warning count, with a finalize control", async () => {
    listTaxReportSnapshotsMock.mockResolvedValue([
      snapshot({
        status: "draft",
        completenessStatus: "partial",
        warnings: ["Some income items are unconfirmed."],
      }),
    ]);
    await renderPage();

    expect(screen.getByText(/in-individual-2025-26\.v1/)).toBeInTheDocument();
    expect(screen.getByText(/1 warning\(s\)/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Finalize this report" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Some income items are unconfirmed."),
    ).toBeInTheDocument();
  });
});

describe("TaxReportsPage — finalized snapshot is immutable", () => {
  it("shows a finalized snapshot's finalized timestamp with no finalize control (no edit path back to draft)", async () => {
    listTaxReportSnapshotsMock.mockResolvedValue([
      snapshot({
        id: "snap-final",
        status: "finalized",
        completenessStatus: "complete",
        finalizedAt: "2026-08-28T00:00:00.000Z",
      }),
    ]);
    await renderPage();

    expect(screen.getByText("finalized")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Finalize this report" }),
    ).not.toBeInTheDocument();
  });
});

describe("TaxReportsPage — regeneration preserves and supersedes the prior snapshot", () => {
  it("lists both the superseded finalized snapshot and its newer replacement, never deleting the old one", async () => {
    listTaxReportSnapshotsMock.mockResolvedValue([
      snapshot({
        id: "snap-new",
        status: "finalized",
        ruleSetVersion: "in-individual-2025-26.v1",
        finalizedAt: "2026-09-01T00:00:00.000Z",
        supersedesSnapshotId: "snap-old",
      }),
      snapshot({
        id: "snap-old",
        status: "superseded",
        ruleSetVersion: "in-individual-2025-26.v1",
        finalizedAt: "2026-08-28T00:00:00.000Z",
        supersededBy: "snap-new",
      }),
    ]);
    await renderPage();

    expect(screen.getByText("finalized")).toBeInTheDocument();
    expect(screen.getByText("superseded")).toBeInTheDocument();
  });

  it("keeps the historical snapshot's own rule-set version even when a newer snapshot uses a different one", async () => {
    listTaxReportSnapshotsMock.mockResolvedValue([
      snapshot({
        id: "snap-new",
        status: "finalized",
        ruleSetVersion: "in-individual-2026-27.v1",
      }),
      snapshot({
        id: "snap-old",
        status: "superseded",
        ruleSetVersion: "in-individual-2025-26.v1",
      }),
    ]);
    await renderPage();

    expect(screen.getByText(/in-individual-2026-27\.v1/)).toBeInTheDocument();
    expect(screen.getByText(/in-individual-2025-26\.v1/)).toBeInTheDocument();
  });
});

describe("TaxReportsPage — CSV exports", () => {
  it("links to all seven CSV export types for the given financial year", async () => {
    await renderPage("2025-26");

    const expectedLabels = [
      "Income summary",
      "Interest report",
      "Dividend report",
      "Capital gains statement",
      "Deduction summary",
      "TDS/TCS & payments summary",
      "AIS/26AS reconciliation",
    ];
    for (const label of expectedLabels) {
      expect(
        screen.getByRole("link", { name: new RegExp(label) }),
      ).toBeInTheDocument();
    }
    expect(
      screen.getByRole("link", { name: /Income summary/ }),
    ).toHaveAttribute("href", "/app/tax/2025-26/export/income");
  });

  it("links to the print-friendly review pack for the given financial year", async () => {
    await renderPage("2025-26");
    expect(screen.getByText("Print-friendly review pack")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Print or save as PDF/i }),
    ).toHaveAttribute("href", "/app/tax/2025-26/reports/print");
  });
});

describe("TaxReportsPage — access control", () => {
  it("redirects an unauthenticated visitor to login", async () => {
    getAuthenticatedUserMock.mockResolvedValue(null);
    await expect(renderPage()).rejects.toThrow(/NEXT_REDIRECT/);
  });

  it("rejects a malformed financial-year id", async () => {
    await expect(renderPage("bad-year")).rejects.toThrow(/NEXT_NOT_FOUND/);
  });
});
