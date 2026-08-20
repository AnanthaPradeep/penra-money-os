// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { INITIAL_TRANSACTION_ACTION_STATE } from "@/lib/ledger/action-state";

vi.mock("server-only", () => ({}));

const getAuthenticatedUserMock = vi.fn();
vi.mock("@/lib/auth/session", () => ({
  getAuthenticatedUser: getAuthenticatedUserMock,
}));

const redirectMock = vi.fn((url: string): never => {
  throw Object.assign(new Error(`NEXT_REDIRECT:${url}`), {
    digest: `NEXT_REDIRECT;push;${url};307;`,
  });
});
vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

const maybeSingleMock = vi.fn();
const eqMock2 = vi.fn(() => ({ maybeSingle: maybeSingleMock }));
const eqMock1 = vi.fn(() => ({ eq: eqMock2 }));
const selectMock = vi.fn(() => ({ eq: eqMock1 }));
const fromMock = vi.fn(() => ({ select: selectMock }));
type RpcResult = {
  data: { id: string } | null;
  error: { code: string; message: string } | null;
};
const rpcMock =
  vi.fn<(fn: string, args: Record<string, unknown>) => Promise<RpcResult>>();

const mockSupabaseClient = { from: fromMock, rpc: rpcMock };
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(() => Promise.resolve(mockSupabaseClient)),
}));

function formDataOf(fields: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    formData.set(key, value);
  }
  return formData;
}

function firstRpcCallArgs(): Record<string, unknown> {
  const call = rpcMock.mock.calls[0];
  if (!call) {
    throw new Error("rpcMock was not called");
  }
  return call[1];
}

const VALID_UUID_A = "11111111-1111-4111-8111-111111111111";
const VALID_UUID_B = "22222222-2222-4222-8222-222222222222";
const VALID_CATEGORY_ID = "33333333-3333-4333-8333-333333333333";
const VALID_IDEMPOTENCY_KEY = "44444444-4444-4444-8444-444444444444";

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-08-16T10:00:00.000Z"));
  getAuthenticatedUserMock.mockResolvedValue({
    id: "user-1",
    email: "a@example.com",
  });
  maybeSingleMock.mockResolvedValue({
    data: { id: "sys-acct-1" },
    error: null,
  });
  rpcMock.mockResolvedValue({ data: { id: "txn-1" }, error: null });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("createIncomeTransactionAction", () => {
  const VALID = {
    toAccountId: VALID_UUID_A,
    categoryId: VALID_CATEGORY_ID,
    amount: "50000",
    occurredOn: "2026-08-16",
    description: "Salary",
    idempotencyKey: VALID_IDEMPOTENCY_KEY,
  };

  it("looks up the Uncategorized Income system account and posts a balanced transaction", async () => {
    const { createIncomeTransactionAction } =
      await import("@/lib/ledger/actions");

    await expect(
      createIncomeTransactionAction(
        INITIAL_TRANSACTION_ACTION_STATE,
        formDataOf(VALID),
      ),
    ).rejects.toThrow(/NEXT_REDIRECT/);

    expect(eqMock1).toHaveBeenCalledWith("system_code", "uncategorized_income");
    expect(redirectMock).toHaveBeenCalledWith(
      "/app/transactions/txn-1?created=1",
    );

    const rpcArgs = firstRpcCallArgs();
    expect(rpcArgs.p_transaction_type).toBe("income");
    expect(rpcArgs.p_category_id).toBe(VALID_CATEGORY_ID);
    expect(rpcArgs.p_idempotency_key).toBe(VALID_IDEMPOTENCY_KEY);
    expect(rpcArgs.p_entries).toEqual([
      { account_id: VALID_UUID_A, amount: "50000.0000", currency: "INR" },
      { account_id: "sys-acct-1", amount: "-50000.0000", currency: "INR" },
    ]);
  });

  it("returns an error without querying the database when unauthenticated", async () => {
    getAuthenticatedUserMock.mockResolvedValue(null);
    const { createIncomeTransactionAction } =
      await import("@/lib/ledger/actions");

    const result = await createIncomeTransactionAction(
      INITIAL_TRANSACTION_ACTION_STATE,
      formDataOf(VALID),
    );

    expect(result.status).toBe("error");
    expect(fromMock).not.toHaveBeenCalled();
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("returns a safe error when the system account cannot be found", async () => {
    maybeSingleMock.mockResolvedValue({ data: null, error: null });
    const { createIncomeTransactionAction } =
      await import("@/lib/ledger/actions");

    const result = await createIncomeTransactionAction(
      INITIAL_TRANSACTION_ACTION_STATE,
      formDataOf(VALID),
    );

    expect(result.status).toBe("error");
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("rejects an invalid amount before touching the database", async () => {
    const { createIncomeTransactionAction } =
      await import("@/lib/ledger/actions");

    const result = await createIncomeTransactionAction(
      INITIAL_TRANSACTION_ACTION_STATE,
      formDataOf({ ...VALID, amount: "-5" }),
    );

    expect(result.status).toBe("error");
    expect(fromMock).not.toHaveBeenCalled();
  });
});

describe("createExpenseTransactionAction", () => {
  it("looks up the Uncategorized Expense system account and posts a balanced transaction", async () => {
    const { createExpenseTransactionAction } =
      await import("@/lib/ledger/actions");

    await expect(
      createExpenseTransactionAction(
        INITIAL_TRANSACTION_ACTION_STATE,
        formDataOf({
          fromAccountId: VALID_UUID_A,
          categoryId: VALID_CATEGORY_ID,
          amount: "1200.5",
          occurredOn: "2026-08-16",
          description: "Groceries",
          idempotencyKey: VALID_IDEMPOTENCY_KEY,
        }),
      ),
    ).rejects.toThrow(/NEXT_REDIRECT/);

    expect(eqMock1).toHaveBeenCalledWith(
      "system_code",
      "uncategorized_expense",
    );
    const rpcArgs = firstRpcCallArgs();
    expect(rpcArgs.p_category_id).toBe(VALID_CATEGORY_ID);
    expect(rpcArgs.p_idempotency_key).toBe(VALID_IDEMPOTENCY_KEY);
    expect(rpcArgs.p_entries).toEqual([
      { account_id: "sys-acct-1", amount: "1200.5000", currency: "INR" },
      { account_id: VALID_UUID_A, amount: "-1200.5000", currency: "INR" },
    ]);
  });
});

describe("createTransferTransactionAction", () => {
  it("posts a transfer without consulting any system account", async () => {
    const { createTransferTransactionAction } =
      await import("@/lib/ledger/actions");

    await expect(
      createTransferTransactionAction(
        INITIAL_TRANSACTION_ACTION_STATE,
        formDataOf({
          fromAccountId: VALID_UUID_A,
          toAccountId: VALID_UUID_B,
          amount: "2000",
          occurredOn: "2026-08-16",
          description: "Move to savings",
          idempotencyKey: VALID_IDEMPOTENCY_KEY,
        }),
      ),
    ).rejects.toThrow(/NEXT_REDIRECT/);

    expect(fromMock).not.toHaveBeenCalled();
    const rpcArgs = firstRpcCallArgs();
    expect(rpcArgs.p_idempotency_key).toBe(VALID_IDEMPOTENCY_KEY);
    expect(rpcArgs.p_category_id).toBeUndefined();
    expect(rpcArgs.p_entries).toEqual([
      { account_id: VALID_UUID_B, amount: "2000.0000", currency: "INR" },
      { account_id: VALID_UUID_A, amount: "-2000.0000", currency: "INR" },
    ]);
  });

  it("rejects a transfer between identical accounts before touching the database", async () => {
    const { createTransferTransactionAction } =
      await import("@/lib/ledger/actions");

    const result = await createTransferTransactionAction(
      INITIAL_TRANSACTION_ACTION_STATE,
      formDataOf({
        fromAccountId: VALID_UUID_A,
        toAccountId: VALID_UUID_A,
        amount: "2000",
        occurredOn: "2026-08-16",
        description: "Move to savings",
      }),
    );

    expect(result.status).toBe("error");
    expect(rpcMock).not.toHaveBeenCalled();
  });
});

describe("createCreditCardPurchaseAction", () => {
  it("debits Uncategorized Expense and credits the credit card", async () => {
    const { createCreditCardPurchaseAction } =
      await import("@/lib/ledger/actions");

    await expect(
      createCreditCardPurchaseAction(
        INITIAL_TRANSACTION_ACTION_STATE,
        formDataOf({
          creditCardAccountId: VALID_UUID_A,
          categoryId: VALID_CATEGORY_ID,
          amount: "999.99",
          occurredOn: "2026-08-16",
          description: "Online order",
          idempotencyKey: VALID_IDEMPOTENCY_KEY,
        }),
      ),
    ).rejects.toThrow(/NEXT_REDIRECT/);

    expect(eqMock1).toHaveBeenCalledWith(
      "system_code",
      "uncategorized_expense",
    );
    const rpcArgs = firstRpcCallArgs();
    expect(rpcArgs.p_category_id).toBe(VALID_CATEGORY_ID);
    expect(rpcArgs.p_idempotency_key).toBe(VALID_IDEMPOTENCY_KEY);
    expect(rpcArgs.p_entries).toEqual([
      { account_id: "sys-acct-1", amount: "999.9900", currency: "INR" },
      { account_id: VALID_UUID_A, amount: "-999.9900", currency: "INR" },
    ]);
  });
});

describe("createCreditCardPaymentAction", () => {
  it("flows asset -> liability without consulting any system account", async () => {
    const { createCreditCardPaymentAction } =
      await import("@/lib/ledger/actions");

    await expect(
      createCreditCardPaymentAction(
        INITIAL_TRANSACTION_ACTION_STATE,
        formDataOf({
          creditCardAccountId: VALID_UUID_A,
          fromAccountId: VALID_UUID_B,
          amount: "5000",
          occurredOn: "2026-08-16",
          description: "Card payment",
          idempotencyKey: VALID_IDEMPOTENCY_KEY,
        }),
      ),
    ).rejects.toThrow(/NEXT_REDIRECT/);

    expect(fromMock).not.toHaveBeenCalled();
    const rpcArgs = firstRpcCallArgs();
    expect(rpcArgs.p_idempotency_key).toBe(VALID_IDEMPOTENCY_KEY);
    expect(rpcArgs.p_category_id).toBeUndefined();
    expect(rpcArgs.p_entries).toEqual([
      { account_id: VALID_UUID_A, amount: "5000.0000", currency: "INR" },
      { account_id: VALID_UUID_B, amount: "-5000.0000", currency: "INR" },
    ]);
  });

  it("rejects paying a credit card from itself before touching the database", async () => {
    const { createCreditCardPaymentAction } =
      await import("@/lib/ledger/actions");

    const result = await createCreditCardPaymentAction(
      INITIAL_TRANSACTION_ACTION_STATE,
      formDataOf({
        creditCardAccountId: VALID_UUID_A,
        fromAccountId: VALID_UUID_A,
        amount: "5000",
        occurredOn: "2026-08-16",
        description: "Card payment",
      }),
    );

    expect(result.status).toBe("error");
    expect(rpcMock).not.toHaveBeenCalled();
  });
});

describe("reverseTransactionAction", () => {
  it("reverses a transaction and redirects to the new reversal transaction", async () => {
    rpcMock.mockResolvedValue({ data: { id: "txn-reversal-1" }, error: null });
    const { reverseTransactionAction } = await import("@/lib/ledger/actions");

    await expect(
      reverseTransactionAction(
        INITIAL_TRANSACTION_ACTION_STATE,
        formDataOf({ transactionId: "txn-1", reason: "Entered twice" }),
      ),
    ).rejects.toThrow(/NEXT_REDIRECT/);

    expect(rpcMock).toHaveBeenCalledWith("reverse_transaction", {
      p_transaction_id: "txn-1",
      p_reason: "Entered twice",
    });
    expect(redirectMock).toHaveBeenCalledWith(
      "/app/transactions/txn-reversal-1?reversed=1",
    );
  });

  it("returns a safe error when the transaction is not eligible for reversal", async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: {
        code: "P0001",
        message: "transaction txn-1 is not eligible for reversal",
      },
    });
    const { reverseTransactionAction } = await import("@/lib/ledger/actions");

    const result = await reverseTransactionAction(
      INITIAL_TRANSACTION_ACTION_STATE,
      formDataOf({ transactionId: "txn-1" }),
    );

    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.message).not.toContain("txn-1");
      expect(result.message).not.toContain("P0001");
    }
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("returns an error without calling the database when unauthenticated", async () => {
    getAuthenticatedUserMock.mockResolvedValue(null);
    const { reverseTransactionAction } = await import("@/lib/ledger/actions");

    const result = await reverseTransactionAction(
      INITIAL_TRANSACTION_ACTION_STATE,
      formDataOf({ transactionId: "txn-1" }),
    );

    expect(result.status).toBe("error");
    expect(rpcMock).not.toHaveBeenCalled();
  });
});
