import {
  ACCOUNT_CLASSES,
  SYSTEM_ACCOUNT_TYPES,
  USER_ACCOUNT_TYPES,
  type AccountClass,
  type AccountType,
} from "@/lib/accounts/classes";
import { Decimal, type Money } from "@/lib/money/decimal";
import type { AccountRow } from "@/lib/accounts/types";
import { assertLiteral } from "@/lib/types/literal";

const ACCOUNT_TYPES = [...USER_ACCOUNT_TYPES, ...SYSTEM_ACCOUNT_TYPES] as const;

export type Account = {
  id: string;
  institutionId: string | null;
  name: string;
  accountClass: AccountClass;
  accountType: AccountType;
  currency: string;
  lastFour: string | null;
  creditLimit: Money | null;
  isSystem: boolean;
  isArchived: boolean;
  openedOn: string | null;
  closedOn: string | null;
  notes: string | null;
};

export function mapAccountRow(row: AccountRow): Account {
  return {
    id: row.id,
    institutionId: row.institution_id,
    name: row.name,
    accountClass: assertLiteral(
      row.account_class,
      ACCOUNT_CLASSES,
      "accounts.account_class",
    ),
    accountType: assertLiteral(
      row.account_type,
      ACCOUNT_TYPES,
      "accounts.account_type",
    ),
    currency: row.currency,
    lastFour: row.last_four,
    creditLimit:
      row.credit_limit === null ? null : new Decimal(row.credit_limit),
    isSystem: row.is_system,
    isArchived: row.is_archived,
    openedOn: row.opened_on,
    closedOn: row.closed_on,
    notes: row.notes,
  };
}
