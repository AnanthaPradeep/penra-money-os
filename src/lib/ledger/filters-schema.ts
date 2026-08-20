import { z } from "zod";

import { MANUAL_TRANSACTION_TYPES } from "@/lib/ledger/transaction-types";
import { TRANSACTION_STATUSES } from "@/lib/ledger/transaction-types";

const optionalTrimmed = z
  .string()
  .optional()
  .transform((raw) => (raw && raw.trim().length > 0 ? raw.trim() : undefined));

const optionalUuid = optionalTrimmed.pipe(z.union([z.undefined(), z.uuid()]));

const ISO_CALENDAR_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const optionalDate = optionalTrimmed.pipe(
  z.union([
    z.undefined(),
    z.string().regex(ISO_CALENDAR_DATE_PATTERN, "Enter a valid date."),
  ]),
);

const optionalDecimalString = optionalTrimmed.pipe(
  z.union([z.undefined(), z.string().regex(/^\d+(\.\d{1,4})?$/)]),
);

/**
 * Validates and normalizes the transaction history page's raw, untrusted
 * URL search params before they ever reach a database query — every
 * field is optional (an absent/invalid filter is simply dropped, never a
 * page error), and page/pageSize are clamped to a sane range so a
 * malformed or malicious query string can't force an unbounded fetch.
 */
export const transactionFiltersSearchParamsSchema = z.object({
  q: optionalTrimmed,
  kind: optionalTrimmed.pipe(
    z.union([z.undefined(), z.enum(MANUAL_TRANSACTION_TYPES)]),
  ),
  account: optionalUuid,
  category: optionalUuid,
  status: optionalTrimmed.pipe(
    z.union([z.undefined(), z.enum(TRANSACTION_STATUSES)]),
  ),
  from: optionalDate,
  to: optionalDate,
  min: optionalDecimalString,
  max: optionalDecimalString,
  page: z.coerce.number().int().min(1).max(10_000).optional().default(1),
});
export type TransactionFiltersSearchParams = z.infer<
  typeof transactionFiltersSearchParamsSchema
>;
