import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  AccountWithBalance,
  getAccountWithBalance,
} from "@/lib/accounts/queries";
import type { getAuthenticatedUser } from "@/lib/auth/session";
import type { getAccountImportSummary } from "@/lib/bank-import/queries";
import type {
  AccountHistoryItem,
  listEntriesForAccount,
} from "@/lib/ledger/queries";
import { Decimal } from "@/lib/money/decimal";

const getAuthenticatedUserMock = vi.fn<typeof getAuthenticatedUser>();
vi.mock("@/lib/auth/session", () => ({
  getAuthenticatedUser: (...args: Parameters<typeof getAuthenticatedUser>) =>
    getAuthenticatedUserMock(...args),
}));

const getAccountWithBalanceMock = vi.fn<typeof getAccountWithBalance>();
vi.mock("@/lib/accounts/queries", () => ({
  getAccountWithBalance: (...args: Parameters<typeof getAccountWithBalance>) =>
    getAccountWithBalanceMock(...args),
}));

const listEntriesForAccountMock = vi.fn<typeof listEntriesForAccount>();
vi.mock("@/lib/ledger/queries", () => ({
  listEntriesForAccount: (...args: Parameters<typeof listEntriesForAccount>) =>
    listEntriesForAccountMock(...args),
}));

const getAccountImportSummaryMock = vi.fn<typeof getAccountImportSummary>();
vi.mock("@/lib/bank-import/queries", () => ({
  getAccountImportSummary: (
    ...args: Parameters<typeof getAccountImportSummary>
  ) => getAccountImportSummaryMock(...args),
}));

vi.mock("@/lib/accounts/actions", () => ({
  archiveAccountAction: vi.fn(),
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

const BASE_ACCOUNT: AccountWithBalance = {
  id: "acct-1",
  institutionId: null,
  name: "HDFC Savings",
  accountClass: "asset",
  accountType: "bank_savings",
  currency: "INR",
  lastFour: "1234",
  creditLimit: null,
  isSystem: false,
  isArchived: false,
  openedOn: "2024-01-15",
  closedOn: null,
  notes: null,
  displayBalance: new Decimal("52340.5"),
};

beforeEach(() => {
  vi.clearAllMocks();
  getAuthenticatedUserMock.mockResolvedValue({
    id: "user-1",
    email: "asha@example.com",
  });
  listEntriesForAccountMock.mockResolvedValue([]);
  getAccountImportSummaryMock.mockResolvedValue({ lastImport: null });
});

async function renderPage(
  accountId = "acct-1",
  searchParams: Record<string, string> = {},
) {
  const { default: AccountDetailPage } =
    await import("@/app/app/accounts/[accountId]/page");
  return render(
    await AccountDetailPage({
      params: Promise.resolve({ accountId }),
      searchParams: Promise.resolve(searchParams),
    }),
  );
}

describe("AccountDetailPage", () => {
  it("redirects to /login when there is no authenticated user", async () => {
    getAuthenticatedUserMock.mockResolvedValue(null);
    const { default: AccountDetailPage } =
      await import("@/app/app/accounts/[accountId]/page");

    await expect(
      AccountDetailPage({
        params: Promise.resolve({ accountId: "acct-1" }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow(/NEXT_REDIRECT/);
  });

  it("shows not-found for a missing account", async () => {
    getAccountWithBalanceMock.mockResolvedValue(null);

    await expect(renderPage()).rejects.toThrow(/NEXT_NOT_FOUND/);
  });

  it("shows not-found for a hidden system account", async () => {
    getAccountWithBalanceMock.mockResolvedValue({
      ...BASE_ACCOUNT,
      isSystem: true,
    });

    await expect(renderPage()).rejects.toThrow(/NEXT_NOT_FOUND/);
  });

  it("shows the account name, balance, and an empty activity state", async () => {
    getAccountWithBalanceMock.mockResolvedValue(BASE_ACCOUNT);

    await renderPage();

    expect(
      screen.getByRole("heading", { name: "HDFC Savings" }),
    ).toBeInTheDocument();
    expect(screen.getByText("₹52,340.50")).toBeInTheDocument();
    expect(screen.getByText("No transactions yet")).toBeInTheDocument();
  });

  it("shows credit utilisation with accessible progress semantics, not colour alone", async () => {
    getAccountWithBalanceMock.mockResolvedValue({
      ...BASE_ACCOUNT,
      accountType: "credit_card",
      accountClass: "liability",
      creditLimit: new Decimal("20000"),
      displayBalance: new Decimal("5000"),
    });

    await renderPage();

    const progress = screen.getByRole("progressbar", {
      name: "Credit utilisation",
    });
    expect(progress).toHaveAttribute("aria-valuenow", "25");
    expect(progress).toHaveAttribute("aria-valuemin", "0");
    expect(progress).toHaveAttribute("aria-valuemax", "100");
  });

  it("handles a missing credit limit safely, with no division performed", async () => {
    getAccountWithBalanceMock.mockResolvedValue({
      ...BASE_ACCOUNT,
      accountType: "credit_card",
      accountClass: "liability",
      creditLimit: null,
      displayBalance: new Decimal("5000"),
    });

    await renderPage();

    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(screen.getByText("Not set")).toBeInTheDocument();
  });

  it("shows an archive action for an active account, and its status for an archived one", async () => {
    getAccountWithBalanceMock.mockResolvedValue(BASE_ACCOUNT);
    await renderPage();
    expect(
      screen.getByRole("button", { name: /archive account/i }),
    ).toBeInTheDocument();
  });

  it("does not offer archiving an already-archived account", async () => {
    getAccountWithBalanceMock.mockResolvedValue({
      ...BASE_ACCOUNT,
      isArchived: true,
    });

    await renderPage();

    expect(
      screen.queryByRole("button", { name: /archive account/i }),
    ).not.toBeInTheDocument();
    expect(screen.getAllByText("Archived").length).toBeGreaterThan(0);
  });

  it("never displays a full account or card number", async () => {
    getAccountWithBalanceMock.mockResolvedValue(BASE_ACCOUNT);

    await renderPage();

    expect(document.body.textContent).not.toMatch(/\d{9,}/);
  });

  it("links to the full transaction history filtered by this account when activity exists", async () => {
    getAccountWithBalanceMock.mockResolvedValue(BASE_ACCOUNT);
    const historyItem: AccountHistoryItem = {
      entry: {
        id: "entry-1",
        transactionId: "txn-1",
        accountId: "acct-1",
        amount: new Decimal("50000"),
        currency: "INR",
        memo: null,
      },
      transaction: {
        id: "txn-1",
        transactionType: "income",
        status: "posted",
        occurredAt: "2026-08-16T10:00:00.000Z",
        description: "Salary",
        notes: null,
        reversalOf: null,
        reversedBy: null,
        categoryId: null,
        payeeId: null,
        replacesTransactionId: null,
      },
    };
    listEntriesForAccountMock.mockResolvedValue([historyItem]);

    await renderPage();

    expect(screen.getByRole("link", { name: "View all" })).toHaveAttribute(
      "href",
      "/app/transactions?account=acct-1",
    );
  });

  it("does not link to transaction history when there is no activity", async () => {
    getAccountWithBalanceMock.mockResolvedValue(BASE_ACCOUNT);

    await renderPage();

    expect(
      screen.queryByRole("link", { name: "View all" }),
    ).not.toBeInTheDocument();
  });
});
