// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { INITIAL_ACCOUNT_ACTION_STATE } from "@/lib/accounts/action-state";

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

type RpcResult = {
  data: { id: string } | null;
  error: { code: string; message: string } | null;
};
const rpcMock =
  vi.fn<(fn: string, args: Record<string, unknown>) => Promise<RpcResult>>();
const mockSupabaseClient = { rpc: rpcMock };
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

const VALID_FIELDS = {
  name: "HDFC Savings",
  accountType: "bank_savings",
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-08-16T10:00:00.000Z"));
  getAuthenticatedUserMock.mockResolvedValue({
    id: "user-1",
    email: "a@example.com",
  });
  rpcMock.mockResolvedValue({ data: { id: "acct-1" }, error: null });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("createAccountAction", () => {
  it("creates an account and redirects to its detail page on success", async () => {
    const { createAccountAction } = await import("@/lib/accounts/actions");

    await expect(
      createAccountAction(
        INITIAL_ACCOUNT_ACTION_STATE,
        formDataOf(VALID_FIELDS),
      ),
    ).rejects.toThrow(/NEXT_REDIRECT/);

    expect(redirectMock).toHaveBeenCalledWith("/app/accounts/acct-1?created=1");
    expect(rpcMock).toHaveBeenCalledWith(
      "create_account_with_opening_balance",
      expect.objectContaining({
        p_name: "HDFC Savings",
        p_account_type: "bank_savings",
      }),
    );
    const callArgs = firstRpcCallArgs();
    expect(callArgs).not.toHaveProperty("p_opening_balance");
    expect(callArgs).not.toHaveProperty("p_opening_balance_at");
  });

  it("never sends an account_class field — the database derives it server-side", async () => {
    const { createAccountAction } = await import("@/lib/accounts/actions");

    await expect(
      createAccountAction(
        INITIAL_ACCOUNT_ACTION_STATE,
        formDataOf(VALID_FIELDS),
      ),
    ).rejects.toThrow();

    const callArgs = firstRpcCallArgs();
    expect(callArgs).not.toHaveProperty("p_account_class");
    expect(callArgs).not.toHaveProperty("account_class");
  });

  it("passes an opening balance amount as an exact decimal string for the text RPC param and derives the timestamp from the opened date", async () => {
    const { createAccountAction } = await import("@/lib/accounts/actions");

    await expect(
      createAccountAction(
        INITIAL_ACCOUNT_ACTION_STATE,
        formDataOf({
          ...VALID_FIELDS,
          openedOn: "2026-08-01",
          openingBalance: "10000",
        }),
      ),
    ).rejects.toThrow();

    const callArgs = firstRpcCallArgs();
    expect(callArgs.p_opening_balance).toBe("10000.0000");
    expect(callArgs.p_opening_balance_at).toBe("2026-07-31T18:30:00.000Z");
  });

  it("returns an error and skips the database when the user is not authenticated", async () => {
    getAuthenticatedUserMock.mockResolvedValue(null);
    const { createAccountAction } = await import("@/lib/accounts/actions");

    const result = await createAccountAction(
      INITIAL_ACCOUNT_ACTION_STATE,
      formDataOf(VALID_FIELDS),
    );

    expect(result.status).toBe("error");
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("returns field errors and skips the database for a credit limit on a non-credit-card account", async () => {
    const { createAccountAction } = await import("@/lib/accounts/actions");

    const result = await createAccountAction(
      INITIAL_ACCOUNT_ACTION_STATE,
      formDataOf({ ...VALID_FIELDS, creditLimit: "50000" }),
    );

    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.fieldErrors?.creditLimit).toBeDefined();
    }
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("returns a safe message when the RPC call fails, never a raw Postgrest error", async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { code: "23514", message: "new row violates check constraint" },
    });
    const { createAccountAction } = await import("@/lib/accounts/actions");

    const result = await createAccountAction(
      INITIAL_ACCOUNT_ACTION_STATE,
      formDataOf(VALID_FIELDS),
    );

    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.message).not.toContain("check constraint");
      expect(result.message).not.toContain("23514");
    }
    expect(redirectMock).not.toHaveBeenCalled();
  });
});
