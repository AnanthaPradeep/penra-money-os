import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { listAccountsWithBalances } from "@/lib/accounts/queries";
import type { getAuthenticatedUser } from "@/lib/auth/session";
import type { listRecentTransactionsForUser } from "@/lib/ledger/queries";
import { Decimal } from "@/lib/money/decimal";
import type { getProfileForUser } from "@/lib/profile/queries";

const getAuthenticatedUserMock = vi.fn<typeof getAuthenticatedUser>();
vi.mock("@/lib/auth/session", () => ({
  getAuthenticatedUser: (...args: Parameters<typeof getAuthenticatedUser>) =>
    getAuthenticatedUserMock(...args),
}));

const getProfileForUserMock = vi.fn<typeof getProfileForUser>();
vi.mock("@/lib/profile/queries", () => ({
  getProfileForUser: (...args: Parameters<typeof getProfileForUser>) =>
    getProfileForUserMock(...args),
}));

const listAccountsWithBalancesMock = vi.fn<typeof listAccountsWithBalances>();
vi.mock("@/lib/accounts/queries", () => ({
  listAccountsWithBalances: (
    ...args: Parameters<typeof listAccountsWithBalances>
  ) => listAccountsWithBalancesMock(...args),
}));

const listRecentTransactionsForUserMock =
  vi.fn<typeof listRecentTransactionsForUser>();
vi.mock("@/lib/ledger/queries", () => ({
  listRecentTransactionsForUser: (
    ...args: Parameters<typeof listRecentTransactionsForUser>
  ) => listRecentTransactionsForUserMock(...args),
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

beforeEach(() => {
  vi.clearAllMocks();
  getAuthenticatedUserMock.mockResolvedValue({
    id: "user-1",
    email: "asha@example.com",
  });
  getProfileForUserMock.mockResolvedValue(null);
  listAccountsWithBalancesMock.mockResolvedValue([]);
  listRecentTransactionsForUserMock.mockResolvedValue([]);
});

describe("AppHomePage", () => {
  it("redirects to /login when there is no authenticated user", async () => {
    getAuthenticatedUserMock.mockResolvedValue(null);
    const { default: AppHomePage } = await import("@/app/app/page");

    await expect(AppHomePage()).rejects.toThrow(/NEXT_REDIRECT/);
    expect(redirectMock).toHaveBeenCalledWith("/login?next=/app");
  });

  it("welcomes the user by their profile display name", async () => {
    getProfileForUserMock.mockResolvedValue({
      id: "user-1",
      display_name: "Asha Rao",
      base_currency: "INR",
      locale: "en-IN",
      timezone: "Asia/Kolkata",
      financial_year_start_month: 4,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    });
    const { default: AppHomePage } = await import("@/app/app/page");

    render(await AppHomePage());

    expect(
      screen.getByRole("heading", { level: 1, name: "Welcome back, Asha Rao" }),
    ).toBeInTheDocument();
  });

  it("falls back to a generic welcome when no display name is set", async () => {
    const { default: AppHomePage } = await import("@/app/app/page");

    render(await AppHomePage());

    expect(
      screen.getByRole("heading", { level: 1, name: "Welcome back" }),
    ).toBeInTheDocument();
  });

  it("shows an onboarding empty state with no accounts", async () => {
    const { default: AppHomePage } = await import("@/app/app/page");

    render(await AppHomePage());

    expect(screen.getByText("Add your first account")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /add an account/i }),
    ).toHaveAttribute("href", "/app/accounts/new");
  });

  it("shows real account balances and a recent-activity feed when accounts exist", async () => {
    listAccountsWithBalancesMock.mockResolvedValue([
      {
        id: "acct-1",
        institutionId: null,
        name: "HDFC Savings",
        accountClass: "asset",
        accountType: "bank_savings",
        currency: "INR",
        lastFour: null,
        creditLimit: null,
        isSystem: false,
        isArchived: false,
        openedOn: null,
        closedOn: null,
        notes: null,
        displayBalance: new Decimal("52340.5"),
      },
    ]);
    listRecentTransactionsForUserMock.mockResolvedValue([
      {
        transaction: {
          id: "txn-1",
          transactionType: "income",
          status: "posted",
          occurredAt: "2026-08-16T10:00:00.000Z",
          description: "Salary",
          notes: null,
          reversalOf: null,
          reversedBy: null,
        },
        primaryEntry: {
          id: "entry-1",
          transactionId: "txn-1",
          accountId: "acct-1",
          amount: new Decimal("50000"),
          currency: "INR",
          memo: null,
          accountName: "HDFC Savings",
          accountClass: "asset",
        },
      },
    ]);
    const { default: AppHomePage } = await import("@/app/app/page");

    render(await AppHomePage());

    expect(screen.getByText("1 active account")).toBeInTheDocument();
    expect(screen.getByText("₹52,340.50")).toBeInTheDocument();
    expect(screen.getByText("Salary")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "New transaction" }),
    ).toHaveAttribute("href", "/app/transactions/new");
  });

  it("never displays the user's full UUID", async () => {
    getAuthenticatedUserMock.mockResolvedValue({
      id: "11111111-1111-1111-1111-111111111111",
      email: "asha@example.com",
    });
    const { default: AppHomePage } = await import("@/app/app/page");

    render(await AppHomePage());

    expect(document.body.textContent).not.toContain(
      "11111111-1111-1111-1111-111111111111",
    );
  });

  it("shows no fabricated balance figures when there are no accounts", async () => {
    const { default: AppHomePage } = await import("@/app/app/page");

    render(await AppHomePage());

    const text = document.body.textContent ?? "";
    expect(text).not.toMatch(/₹\s*[\d,]+/);
  });
});
