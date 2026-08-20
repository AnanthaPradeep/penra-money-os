import type { PayeeRow } from "@/lib/payees/types";

export type Payee = {
  id: string;
  name: string;
  isArchived: boolean;
};

export function mapPayeeRow(row: PayeeRow): Payee {
  return {
    id: row.id,
    name: row.name,
    isArchived: row.is_archived,
  };
}
