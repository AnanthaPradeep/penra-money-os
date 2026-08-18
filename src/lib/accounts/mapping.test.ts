import { describe, expect, it } from "vitest";

import { Decimal } from "@/lib/money/decimal";
import { mapAccountRow } from "@/lib/accounts/mapping";
import type { AccountRow } from "@/lib/accounts/types";

const BASE_ROW: AccountRow = {
  id: "acct-1",
  user_id: "user-1",
  institution_id: "inst-1",
  name: "HDFC Savings",
  account_class: "asset",
  account_type: "bank_savings",
  currency: "INR",
  last_four: "1234",
  credit_limit: null,
  system_code: null,
  is_system: false,
  is_archived: false,
  opened_on: "2024-01-01",
  closed_on: null,
  notes: null,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
};

describe("mapAccountRow", () => {
  it("maps a database row to a domain Account", () => {
    const account = mapAccountRow(BASE_ROW);
    expect(account).toEqual({
      id: "acct-1",
      institutionId: "inst-1",
      name: "HDFC Savings",
      accountClass: "asset",
      accountType: "bank_savings",
      currency: "INR",
      lastFour: "1234",
      creditLimit: null,
      isSystem: false,
      isArchived: false,
      openedOn: "2024-01-01",
      closedOn: null,
      notes: null,
    });
  });

  it("converts a non-null credit_limit into a Decimal", () => {
    const account = mapAccountRow({ ...BASE_ROW, credit_limit: 50000 });
    expect(account.creditLimit).toBeInstanceOf(Decimal);
    expect(account.creditLimit?.toString()).toBe("50000");
  });

  it("keeps a null credit_limit as null rather than a Decimal(0)", () => {
    const account = mapAccountRow(BASE_ROW);
    expect(account.creditLimit).toBeNull();
  });
});
