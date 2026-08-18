import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  AccountWithBalance,
  listAccountsWithBalances,
} from "@/lib/accounts/queries";
import type { getAuthenticatedUser } from "@/lib/auth/session";
import { Decimal } from "@/lib/money/decimal";

const getAuthenticatedUserMock = vi.fn<typeof getAuthenticatedUser>();
vi.mock("@/lib/auth/session", () => ({
  getAuthenticatedUser: (...args: Parameters<typeof getAuthenticatedUser>) =>
    getAuthenticatedUserMock(...args),
}));

const listAccountsWithBalancesMock = vi.fn<typeof listAccountsWithBalances>();
vi.mock("@/lib/accounts/queries", () => ({
  listAccountsWithBalances: (
    ...args: Parameters<typeof listAccountsWithBalances>
  ) => listAccountsWithBalancesMock(...args),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(() => Promise.resolve({})),
}));

const redirectMock = vi.fn((url: string): never => {
  throw Object.assign(new Error(`NEXT_REDIRECT:${url}`), {
    digest: `NEXT_REDIRECT;push;${url};307;`,
  });
});
vi.mock("next/navigation", () => ({ redirect: redirectMock }));

function account(
  overrides: Partial<AccountWithBalance> = {},
): AccountWithBalance {
  return {
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
    openedOn: null,
    closedOn: null,
    notes: null,
    displayBalance: new Decimal("52340.5"),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  getAuthenticatedUserMock.mockResolvedValue({
    id: "user-1",
    email: "asha@example.com",
  });
});

describe("AccountsPage", () => {
  it("redirects to /login when there is no authenticated user", async () => {
    getAuthenticatedUserMock.mockResolvedValue(null);
    listAccountsWithBalancesMock.mockResolvedValue([]);
    const { default: AccountsPage } = await import("@/app/app/accounts/page");

    await expect(AccountsPage()).rejects.toThrow(/NEXT_REDIRECT/);
    expect(redirectMock).toHaveBeenCalledWith("/login?next=/app/accounts");
  });

  it("shows an empty state with no accounts", async () => {
    listAccountsWithBalancesMock.mockResolvedValue([]);
    const { default: AccountsPage } = await import("@/app/app/accounts/page");

    render(await AccountsPage());

    expect(screen.getByText("No accounts yet")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /add your first account/i }),
    ).toHaveAttribute("href", "/app/accounts/new");
  });

  it("separates active assets from liabilities", async () => {
    listAccountsWithBalancesMock.mockResolvedValue([
      account({ id: "acct-1", name: "HDFC Savings", accountClass: "asset" }),
      account({
        id: "acct-2",
        name: "ICICI Platinum",
        accountClass: "liability",
        accountType: "credit_card",
        displayBalance: new Decimal("5000"),
      }),
    ]);
    const { default: AccountsPage } = await import("@/app/app/accounts/page");

    render(await AccountsPage());

    expect(screen.getByRole("heading", { name: "Assets" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Liabilities" }),
    ).toBeInTheDocument();
    expect(screen.getByText("HDFC Savings")).toBeInTheDocument();
    expect(screen.getByText("ICICI Platinum")).toBeInTheDocument();
  });

  it("shows real balances and last-four digits, never a full account number", async () => {
    listAccountsWithBalancesMock.mockResolvedValue([account()]);
    const { default: AccountsPage } = await import("@/app/app/accounts/page");

    render(await AccountsPage());

    expect(screen.getByText("₹52,340.50")).toBeInTheDocument();
    expect(screen.getByText(/•••• 1234/)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/\d{9,}/);
  });

  it("groups archived accounts separately, collapsed by default", async () => {
    listAccountsWithBalancesMock.mockResolvedValue([
      account({ id: "acct-1", name: "Active Account" }),
      account({ id: "acct-2", name: "Old Wallet", isArchived: true }),
    ]);
    const { default: AccountsPage } = await import("@/app/app/accounts/page");

    render(await AccountsPage());

    expect(screen.getByText(/archived \(1\)/i)).toBeInTheDocument();
  });

  it("has a link to add a new account", async () => {
    listAccountsWithBalancesMock.mockResolvedValue([account()]);
    const { default: AccountsPage } = await import("@/app/app/accounts/page");

    render(await AccountsPage());

    expect(screen.getByRole("link", { name: "New account" })).toHaveAttribute(
      "href",
      "/app/accounts/new",
    );
  });
});
