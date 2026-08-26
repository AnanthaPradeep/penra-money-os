import { z } from "zod";

import { STATEMENT_DATE_FORMATS } from "@/lib/bank-import/types";
import { optionalPositiveMoneyInputSchema } from "@/lib/money/schema";

/**
 * Zod validation at every server-action boundary, per the Phase 11 spec —
 * `unknown` only ever reaches these schemas (raw FormData strings), never
 * an already-typed domain object trusted from the client.
 */

const uuidSchema = z.uuid("Choose a valid option.");
const optionalUuidSchema = z
  .string()
  .optional()
  .transform((raw) => (raw && raw.trim().length > 0 ? raw.trim() : undefined))
  .pipe(z.union([z.undefined(), uuidSchema]));

const optionalColumnNameSchema = z
  .string()
  .optional()
  .transform((raw) => (raw && raw.trim().length > 0 ? raw.trim() : undefined))
  .pipe(z.union([z.undefined(), z.string().max(200)]));

export const uploadStatementSchema = z.object({
  accountId: uuidSchema,
});
export type UploadStatementInput = z.infer<typeof uploadStatementSchema>;

export const columnMappingSchema = z
  .object({
    importId: uuidSchema,
    dateColumn: z.string().min(1, "Choose the date column."),
    descriptionColumn: z.string().min(1, "Choose the description column."),
    dateFormat: z.enum(STATEMENT_DATE_FORMATS, {
      error: "Choose a date format.",
    }),
    valueDateColumn: optionalColumnNameSchema,
    referenceColumn: optionalColumnNameSchema,
    debitColumn: optionalColumnNameSchema,
    creditColumn: optionalColumnNameSchema,
    amountColumn: optionalColumnNameSchema,
    transactionTypeColumn: optionalColumnNameSchema,
    balanceColumn: optionalColumnNameSchema,
    amountSignConvention: z.enum(["debit_negative", "debit_positive"]),
    saveAsPreset: z
      .union([z.literal("on"), z.literal("")])
      .optional()
      .transform((raw) => raw === "on"),
    bankLabel: z
      .string()
      .optional()
      .transform((raw) =>
        raw && raw.trim().length > 0 ? raw.trim() : undefined,
      ),
  })
  .refine(
    (data) => data.debitColumn || data.creditColumn || data.amountColumn,
    {
      error: "Choose either debit/credit columns or a single amount column.",
      path: ["amountColumn"],
    },
  )
  .refine(
    (data) => !((data.debitColumn || data.creditColumn) && data.amountColumn),
    {
      error: "Choose debit/credit columns or a single amount column, not both.",
      path: ["amountColumn"],
    },
  );
export type ColumnMappingInput = z.infer<typeof columnMappingSchema>;

export const updateRowSchema = z.object({
  rowId: uuidSchema,
  userDecision: z.enum(["pending", "include", "exclude"]).optional(),
  categoryId: optionalUuidSchema,
  payeeId: optionalUuidSchema,
  resolvedTransactionType: z
    .enum([
      "income",
      "expense",
      "transfer",
      "credit_card_purchase",
      "credit_card_payment",
    ])
    .optional(),
  counterpartyAccountId: optionalUuidSchema,
  notes: z
    .string()
    .optional()
    .transform((raw) => (raw && raw.trim().length > 0 ? raw.trim() : undefined))
    .pipe(z.union([z.undefined(), z.string().max(2000)])),
});
export type UpdateRowInput = z.infer<typeof updateRowSchema>;

export const bulkUpdateRowsSchema = z.object({
  importId: uuidSchema,
  rowIds: z.array(uuidSchema).min(1, "Select at least one row.").max(2000),
  userDecision: z.enum(["pending", "include", "exclude"]).optional(),
  categoryId: optionalUuidSchema,
  payeeId: optionalUuidSchema,
});
export type BulkUpdateRowsInput = z.infer<typeof bulkUpdateRowsSchema>;

export const linkExistingTransactionSchema = z.object({
  rowId: uuidSchema,
  transactionId: uuidSchema,
});
export type LinkExistingTransactionInput = z.infer<
  typeof linkExistingTransactionSchema
>;

export const confirmTransferMatchSchema = z.object({
  rowId: uuidSchema,
  candidateRowId: uuidSchema,
});
export type ConfirmTransferMatchInput = z.infer<
  typeof confirmTransferMatchSchema
>;

export const saveImportRuleSchema = z
  .object({
    ruleId: optionalUuidSchema,
    name: z.string().trim().min(1, "Enter a name.").max(100),
    matchField: z.enum([
      "description_contains",
      "description_starts_with",
      "description_exact",
      "reference_prefix",
    ]),
    matchValue: z.string().trim().min(1, "Enter a value to match.").max(200),
    directionFilter: z
      .union([z.literal("debit"), z.literal("credit"), z.literal("")])
      .optional()
      .transform((raw) => (raw ? raw : undefined)),
    accountId: optionalUuidSchema,
    minAmount: optionalPositiveMoneyInputSchema,
    maxAmount: optionalPositiveMoneyInputSchema,
    suggestedTransactionType: z
      .union([
        z.enum([
          "income",
          "expense",
          "transfer",
          "credit_card_purchase",
          "credit_card_payment",
        ]),
        z.literal(""),
      ])
      .optional()
      .transform((raw) => (raw ? raw : undefined)),
    suggestedCategoryId: optionalUuidSchema,
    suggestedPayeeId: optionalUuidSchema,
    notesTemplate: z
      .string()
      .optional()
      .transform((raw) =>
        raw && raw.trim().length > 0 ? raw.trim() : undefined,
      )
      .pipe(z.union([z.undefined(), z.string().max(300)])),
    exclude: z
      .union([z.literal("on"), z.literal("")])
      .optional()
      .transform((raw) => raw === "on"),
    priority: z
      .string()
      .optional()
      .transform((raw) =>
        raw && raw.trim().length > 0 ? Number.parseInt(raw, 10) : 0,
      )
      .pipe(z.number().int().min(-1000).max(1000)),
  })
  .refine(
    (data) =>
      data.minAmount === undefined ||
      data.maxAmount === undefined ||
      data.minAmount.lessThanOrEqualTo(data.maxAmount),
    {
      error: "Minimum amount must be less than or equal to the maximum.",
      path: ["maxAmount"],
    },
  );
export type SaveImportRuleInput = z.infer<typeof saveImportRuleSchema>;

export const reconciliationBalancesSchema = z.object({
  importId: uuidSchema,
  openingBalance: z
    .string()
    .optional()
    .transform((raw) =>
      raw && raw.trim().length > 0 ? raw.trim() : undefined,
    ),
  closingBalance: z
    .string()
    .optional()
    .transform((raw) =>
      raw && raw.trim().length > 0 ? raw.trim() : undefined,
    ),
});
export type ReconciliationBalancesInput = z.infer<
  typeof reconciliationBalancesSchema
>;
