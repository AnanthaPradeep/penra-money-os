import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { getAuthenticatedUser } from "@/lib/auth/session";
import type { getTransactionWithEntries } from "@/lib/ledger/queries";
import { Decimal } from "@/lib/money/decimal";
import type {
  getTransactionPurposeAllocation,
  listIncomeAllocationApplications,
  listIncomeAllocationPlans,
  listPurposeWallets,
} from "@/lib/wallets/queries";

const getAuthenticatedUserMock = vi.fn<typeof getAuthenticatedUser>();
vi.mock("@/lib/auth/session", () => ({
  getAuthenticatedUser: (...args: Parameters<typeof getAuthenticatedUser>) =>
    getAuthenticatedUserMock(...args),
}));

const getTransactionWithEntriesMock = vi.fn<typeof getTransactionWithEntries>();
vi.mock("@/lib/ledger/queries", () => ({
  getTransactionWithEntries: (
    ...args: Parameters<typeof getTransactionWithEntries>
  ) => getTransactionWithEntriesMock(...args),
}));

vi.mock("@/lib/ledger/actions", () => ({
  reverseTransactionAction: vi.fn(),
  editTransactionAction: vi.fn(),
}));

// The page now also offers wallet assignment (expense/credit_card_purchase)
// and income-allocation-plan application (income) — both transitively
// import the server-only Supabase client factory via wallets/queries, and
// their Server Actions are rendered by real client components here, so
// both get mocked out the same way the ledger actions above already are.
const getTransactionPurposeAllocationMock =
  vi.fn<typeof getTransactionPurposeAllocation>();
const listPurposeWalletsMock = vi.fn<typeof listPurposeWallets>();
const listIncomeAllocationPlansMock = vi.fn<typeof listIncomeAllocationPlans>();
const listIncomeAllocationApplicationsMock =
  vi.fn<typeof listIncomeAllocationApplications>();
vi.mock("@/lib/wallets/queries", () => ({
  getTransactionPurposeAllocation: (
    ...args: Parameters<typeof getTransactionPurposeAllocation>
  ) => getTransactionPurposeAllocationMock(...args),
  listPurposeWallets: (...args: Parameters<typeof listPurposeWallets>) =>
    listPurposeWalletsMock(...args),
  listIncomeAllocationPlans: (
    ...args: Parameters<typeof listIncomeAllocationPlans>
  ) => listIncomeAllocationPlansMock(...args),
  listIncomeAllocationApplications: (
    ...args: Parameters<typeof listIncomeAllocationApplications>
  ) => listIncomeAllocationApplicationsMock(...args),
}));
vi.mock("@/lib/wallets/actions", () => ({
  assignTransactionToPurposeWalletAction: vi.fn(),
  unassignTransactionPurposeWalletAction: vi.fn(),
  applyIncomeAllocationPlanToTransactionAction: vi.fn(),
}));

// The page also loads categories/payees for the (now-real) edit dialog, and
// EditTransactionForm's PayeeCombobox can create a payee — all three chains
// transitively import the server-only Supabase client factory, so mock them
// out here rather than letting the real modules load in this jsdom test.
vi.mock("@/lib/categories/queries", () => ({
  listCategories: vi.fn(() => Promise.resolve([])),
}));
vi.mock("@/lib/payees/queries", () => ({
  listPayees: vi.fn(() => Promise.resolve([])),
}));
vi.mock("@/lib/payees/actions", () => ({
  createPayeeAction: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(() => Promise.resolve({})),
}));

const redirectMock = vi.fn((url: string): never => {
  throw Object.assign(new Error(`NEXT_REDIRECT:${url}`), {
    digest: `NEXT_REDIRECT;push;${url};307;`,
  });
});
const notFoundMock = vi.fn((): never => {
  throw Object.assign(new Error("NEXT_NOT_FOUND"), {
    digest: "NEXT_NOT_FOUND",
  });
});
vi.mock("next/navigation", () => ({
  redirect: redirectMock,
  notFound: notFoundMock,
}));

const BASE_DETAIL = {
  transaction: {
    id: "txn-1",
    transactionType: "income" as const,
    status: "posted" as const,
    occurredAt: "2026-08-16T10:00:00.000Z",
    description: "Salary",
    notes: null,
    reversalOf: null,
    reversedBy: null,
    categoryId: null,
    payeeId: null,
    replacesTransactionId: null,
  },
  entries: [
    {
      id: "entry-1",
      transactionId: "txn-1",
      accountId: "acct-1",
      amount: new Decimal("50000"),
      currency: "INR",
      memo: null,
      accountName: "HDFC Savings",
      accountClass: "asset",
    },
  ],
  categoryName: null,
  payeeName: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  getAuthenticatedUserMock.mockResolvedValue({
    id: "user-1",
    email: "asha@example.com",
  });
  getTransactionPurposeAllocationMock.mockResolvedValue(null);
  listPurposeWalletsMock.mockResolvedValue([]);
  listIncomeAllocationPlansMock.mockResolvedValue([]);
  listIncomeAllocationApplicationsMock.mockResolvedValue([]);
});

async function renderPage(
  transactionId = "txn-1",
  searchParams: Record<string, string> = {},
) {
  const { default: TransactionDetailPage } =
    await import("@/app/app/transactions/[transactionId]/page");
  return render(
    await TransactionDetailPage({
      params: Promise.resolve({ transactionId }),
      searchParams: Promise.resolve(searchParams),
    }),
  );
}

describe("TransactionDetailPage", () => {
  it("shows not-found for a missing or foreign transaction", async () => {
    getTransactionWithEntriesMock.mockResolvedValue(null);

    await expect(renderPage()).rejects.toThrow(/NEXT_NOT_FOUND/);
  });

  it("shows the description, type, status, and affected accounts", async () => {
    getTransactionWithEntriesMock.mockResolvedValue(BASE_DETAIL);

    await renderPage();

    expect(screen.getByRole("heading", { name: "Salary" })).toBeInTheDocument();
    expect(screen.getByText("Posted")).toBeInTheDocument();
    expect(screen.getByText("HDFC Savings")).toBeInTheDocument();
    expect(screen.getByText("₹50,000.00")).toBeInTheDocument();
  });

  it("offers a reversal action for a posted transaction", async () => {
    getTransactionWithEntriesMock.mockResolvedValue(BASE_DETAIL);

    await renderPage();

    expect(
      screen.getByRole("button", { name: /reverse this transaction/i }),
    ).toBeInTheDocument();
  });

  it("disables the reversal action for an already-reversed transaction", async () => {
    getTransactionWithEntriesMock.mockResolvedValue({
      ...BASE_DETAIL,
      transaction: { ...BASE_DETAIL.transaction, status: "reversed" },
    });

    await renderPage();

    expect(
      screen.queryByRole("button", { name: /reverse this transaction/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Reversed")).toBeInTheDocument();
  });

  it("links to the reversal transaction when this one was reversed", async () => {
    getTransactionWithEntriesMock.mockResolvedValue({
      ...BASE_DETAIL,
      transaction: {
        ...BASE_DETAIL.transaction,
        status: "reversed",
        reversedBy: "txn-2",
      },
    });

    await renderPage();

    expect(
      screen.getByRole("link", { name: /this transaction/i }),
    ).toHaveAttribute("href", "/app/transactions/txn-2");
  });

  it("links back to the original transaction when viewing a reversal", async () => {
    getTransactionWithEntriesMock.mockResolvedValue({
      ...BASE_DETAIL,
      transaction: {
        ...BASE_DETAIL.transaction,
        id: "txn-2",
        description: "Reversal of: Salary",
        reversalOf: "txn-1",
      },
    });

    await renderPage("txn-2");

    expect(
      screen.getByRole("link", { name: /this transaction/i }),
    ).toHaveAttribute("href", "/app/transactions/txn-1");
  });

  it("does not use the word delete for a reversal", async () => {
    getTransactionWithEntriesMock.mockResolvedValue(BASE_DETAIL);

    await renderPage();

    expect(document.body.textContent?.toLowerCase()).not.toContain("delete");
  });
});
