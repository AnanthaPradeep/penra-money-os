import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { listAccountsWithBalances } from "@/lib/accounts/queries";
import type { getAuthenticatedUser } from "@/lib/auth/session";
import type { listCategories } from "@/lib/categories/queries";
import { Decimal } from "@/lib/money/decimal";
import type { listPayees } from "@/lib/payees/queries";
import type {
  OccurrenceWithItem,
  RecurringItem,
} from "@/lib/recurring/mapping";
import type {
  getSubscriptionCostSummary,
  listLinkableTransactions,
  listOccurrencesWithItems,
  listRecurringItems,
  listUpcomingCommitments,
  SubscriptionCostSummary,
} from "@/lib/recurring/queries";

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

const listCategoriesMock = vi.fn<typeof listCategories>();
vi.mock("@/lib/categories/queries", () => ({
  listCategories: (...args: Parameters<typeof listCategories>) =>
    listCategoriesMock(...args),
}));

const listPayeesMock = vi.fn<typeof listPayees>();
vi.mock("@/lib/payees/queries", () => ({
  listPayees: (...args: Parameters<typeof listPayees>) =>
    listPayeesMock(...args),
}));

const listRecurringItemsMock = vi.fn<typeof listRecurringItems>();
const listOccurrencesWithItemsMock = vi.fn<typeof listOccurrencesWithItems>();
const listUpcomingCommitmentsMock = vi.fn<typeof listUpcomingCommitments>();
const getSubscriptionCostSummaryMock =
  vi.fn<typeof getSubscriptionCostSummary>();
const listLinkableTransactionsMock = vi.fn<typeof listLinkableTransactions>();
vi.mock("@/lib/recurring/queries", () => ({
  listRecurringItems: (...args: Parameters<typeof listRecurringItems>) =>
    listRecurringItemsMock(...args),
  listOccurrencesWithItems: (
    ...args: Parameters<typeof listOccurrencesWithItems>
  ) => listOccurrencesWithItemsMock(...args),
  listUpcomingCommitments: (
    ...args: Parameters<typeof listUpcomingCommitments>
  ) => listUpcomingCommitmentsMock(...args),
  getSubscriptionCostSummary: (
    ...args: Parameters<typeof getSubscriptionCostSummary>
  ) => getSubscriptionCostSummaryMock(...args),
  listLinkableTransactions: (
    ...args: Parameters<typeof listLinkableTransactions>
  ) => listLinkableTransactionsMock(...args),
}));

vi.mock("@/lib/recurring/actions", () => ({
  recordOccurrencePaymentAction: vi.fn(),
  linkExistingTransactionAction: vi.fn(),
  skipOccurrenceAction: vi.fn(),
  retryFailedOccurrenceAction: vi.fn(),
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
vi.mock("next/navigation", () => ({
  redirect: redirectMock,
  useRouter: () => ({ refresh: vi.fn() }),
}));

const ZERO_SUBSCRIPTION_COSTS: SubscriptionCostSummary = {
  monthlyEstimate: new Decimal(0),
  annualEstimate: new Decimal(0),
  activeSubscriptionCount: 0,
};

const ITEM: RecurringItem = {
  id: "item-1",
  name: "Electricity bill",
  kind: "bill",
  amount: new Decimal(1500),
  currency: "INR",
  sourceAccountId: "acct-1",
  destinationAccountId: null,
  categoryId: "cat-1",
  payeeId: null,
  notes: null,
  startDate: "2026-01-01",
  endDate: null,
  frequency: "monthly",
  intervalCount: 1,
  nextDueDate: "2026-08-15",
  processingMode: "reminder_only",
  status: "active",
  trialEndDate: null,
  cancellationDate: null,
};

function occurrenceWithItem(
  overrides: Partial<OccurrenceWithItem>,
): OccurrenceWithItem {
  return {
    id: "occ-1",
    recurringItemId: "item-1",
    scheduledDate: "2026-08-15",
    amount: new Decimal(1500),
    currency: "INR",
    status: "due",
    linkedTransactionId: null,
    failureReason: null,
    processedAt: null,
    itemName: "Electricity bill",
    itemKind: "bill",
    processingMode: "reminder_only",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  getAuthenticatedUserMock.mockResolvedValue({
    id: "user-1",
    email: "asha@example.com",
  });
  listRecurringItemsMock.mockResolvedValue([]);
  listOccurrencesWithItemsMock.mockResolvedValue([]);
  listUpcomingCommitmentsMock.mockResolvedValue([]);
  getSubscriptionCostSummaryMock.mockResolvedValue(ZERO_SUBSCRIPTION_COSTS);
  listAccountsWithBalancesMock.mockResolvedValue([]);
  listCategoriesMock.mockResolvedValue([]);
  listPayeesMock.mockResolvedValue([]);
  listLinkableTransactionsMock.mockResolvedValue([]);
});

async function renderPage() {
  const { default: RecurringOverviewPage } =
    await import("@/app/app/recurring/page");
  return render(await RecurringOverviewPage());
}

describe("RecurringOverviewPage", () => {
  it("redirects to login when there is no authenticated user", async () => {
    getAuthenticatedUserMock.mockResolvedValue(null);

    await expect(renderPage()).rejects.toThrow(/NEXT_REDIRECT/);
  });

  it("shows empty states when there is nothing due, overdue, failed, upcoming, or recurring at all", async () => {
    await renderPage();

    expect(screen.getByText("Nothing needs attention")).toBeInTheDocument();
    expect(
      screen.getByText("Nothing scheduled in the next 30 days."),
    ).toBeInTheDocument();
    expect(screen.getByText("No recurring items yet")).toBeInTheDocument();
  });

  it("shows a due occurrence under Needs attention, with its record-payment action", async () => {
    listOccurrencesWithItemsMock.mockImplementation((_supabase, status) => {
      if (status === "due") {
        return Promise.resolve([occurrenceWithItem({ status: "due" })]);
      }
      return Promise.resolve([]);
    });
    listRecurringItemsMock.mockResolvedValue([ITEM]);

    await renderPage();

    expect(
      screen.queryByText("Nothing needs attention"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Record payment" }),
    ).toBeInTheDocument();
  });

  it("shows an overdue occurrence under Needs attention", async () => {
    listOccurrencesWithItemsMock.mockImplementation((_supabase, status) => {
      if (status === "overdue") {
        return Promise.resolve([
          occurrenceWithItem({ id: "occ-overdue", status: "overdue" }),
        ]);
      }
      return Promise.resolve([]);
    });
    listRecurringItemsMock.mockResolvedValue([ITEM]);

    await renderPage();

    expect(screen.getByText("Overdue")).toBeInTheDocument();
  });

  it("shows a failed occurrence under Needs attention with a Retry action", async () => {
    listOccurrencesWithItemsMock.mockImplementation((_supabase, status) => {
      if (status === "failed") {
        return Promise.resolve([
          occurrenceWithItem({
            id: "occ-failed",
            status: "failed",
            processingMode: "auto_post",
          }),
        ]);
      }
      return Promise.resolve([]);
    });
    listRecurringItemsMock.mockResolvedValue([ITEM]);

    await renderPage();

    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("lists an upcoming occurrence in the 30-day section, not duplicated in Needs attention", async () => {
    listUpcomingCommitmentsMock.mockResolvedValue([
      occurrenceWithItem({ id: "occ-upcoming", status: "upcoming" }),
    ]);
    listRecurringItemsMock.mockResolvedValue([ITEM]);

    await renderPage();

    expect(
      screen.queryByText("Nothing scheduled in the next 30 days."),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Nothing needs attention")).toBeInTheDocument();
  });

  it("shows the subscription monthly-cost estimate", async () => {
    getSubscriptionCostSummaryMock.mockResolvedValue({
      monthlyEstimate: new Decimal(999),
      annualEstimate: new Decimal(11988),
      activeSubscriptionCount: 2,
    });

    await renderPage();

    expect(screen.getByText("₹999.00")).toBeInTheDocument();
  });

  it("renders every recurring item passed through to the filter list", async () => {
    listRecurringItemsMock.mockResolvedValue([ITEM]);

    await renderPage();

    expect(screen.getByText("Electricity bill")).toBeInTheDocument();
  });
});
