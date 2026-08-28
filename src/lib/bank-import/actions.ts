"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { UserAccountType } from "@/lib/accounts/classes";
import {
  type BankImportActionState,
  type UploadStatementActionState,
} from "@/lib/bank-import/action-state";
import {
  MAX_STATEMENT_IMPORT_ROWS,
  MATCH_DATE_WINDOW_DAYS,
} from "@/lib/bank-import/limits";
import {
  amountShapeForMapping,
  detectColumnMapping,
  inferBaseTransactionType,
  type ImportRule,
} from "@/lib/bank-import/mapping";
import { normalizeStatementRow } from "@/lib/bank-import/normalize";
import { parseStatementAmountCell } from "@/lib/bank-import/money";
import {
  rankCandidates,
  scoreExistingTransactionCandidate,
  scoreTransferCandidate,
} from "@/lib/bank-import/matching";
import { parseStatementFile } from "@/lib/bank-import/parser";
import {
  findColumnMappingPresetByFingerprint,
  findExistingTransactionCandidates,
  findTransferCandidateRows,
  listImportRules,
} from "@/lib/bank-import/queries";
import { evaluateImportRules } from "@/lib/bank-import/rules";
import {
  bulkUpdateRowsSchema,
  columnMappingSchema,
  confirmTransferMatchSchema,
  linkExistingTransactionSchema,
  reconciliationBalancesSchema,
  saveImportRuleSchema,
  updateRowSchema,
  uploadStatementSchema,
} from "@/lib/bank-import/schema";
import type {
  ImportableTransactionType,
  RawParsedRow,
  RowDirection,
  StatementColumnMapping,
} from "@/lib/bank-import/types";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { nowAsIstCalendarDate } from "@/lib/dates/timezone";
import { Decimal } from "@/lib/money/decimal";
import { toDbAmountString } from "@/lib/money/parse";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";

function readFormString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function fieldErrorsFromZod(error: z.ZodError): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    if (!(key in fieldErrors)) {
      fieldErrors[key] = issue.message;
    }
  }
  return fieldErrors;
}

function logImportError(context: string, code: string | undefined): void {
  if (process.env.NODE_ENV === "production") {
    return;
  }
  console.error(`[bank-import:${context}]`, { code: code ?? "unknown" });
}

const NOT_SIGNED_IN_MESSAGE = "You need to sign in again to continue.";
const GENERIC_FAILURE_MESSAGE = "Something went wrong. Please try again.";

function sanitizeFilename(name: string): string {
  return name.replace(/[\\/]/g, "_").trim().slice(0, 200) || "statement";
}

// ---------------------------------------------------------------------
// Upload — parses the file entirely in this one request, creates the
// statement_imports shell, and returns the tokenized header/rows to the
// client so the mapping step can round-trip them back without the server
// ever persisting the raw file (see parser.ts's module comment).
// ---------------------------------------------------------------------
export async function uploadStatementAction(
  _prevState: UploadStatementActionState,
  formData: FormData,
): Promise<UploadStatementActionState> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { status: "error", message: NOT_SIGNED_IN_MESSAGE };
  }

  const parsed = uploadStatementSchema.safeParse({
    accountId: readFormString(formData, "accountId"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { status: "error", message: "Choose a statement file to upload." };
  }

  const supabase = await createSupabaseServerClient();

  const { data: account, error: accountError } = await supabase
    .from("accounts")
    .select("id, currency, is_archived, is_system")
    .eq("id", parsed.data.accountId)
    .maybeSingle();
  if (accountError || !account) {
    return { status: "error", message: "Choose a valid account." };
  }
  if (account.is_archived || account.is_system) {
    return {
      status: "error",
      message: "This account can't receive an import.",
    };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const tokenized = parseStatementFile(bytes, file.name, file.type);
  if (!tokenized.success) {
    return { status: "error", message: tokenized.error };
  }

  const [heuristic, preset] = await Promise.all([
    Promise.resolve(detectColumnMapping(tokenized.header)),
    findColumnMappingPresetByFingerprint(supabase, tokenized.headerFingerprint),
  ]);

  const { data: created, error: createError } = await supabase.rpc(
    "create_statement_import",
    {
      p_account_id: parsed.data.accountId,
      p_original_filename: sanitizeFilename(file.name),
      p_file_hash: tokenized.fileHash,
      p_file_format: tokenized.format,
      p_file_size_bytes: tokenized.fileSizeBytes,
      p_detected_delimiter: tokenized.delimiter,
      p_detected_encoding: tokenized.encoding,
      p_header_fingerprint: tokenized.headerFingerprint,
      p_currency: account.currency,
      p_row_count_hint: tokenized.rows.length,
    },
  );

  if (createError || !created || created.length === 0) {
    logImportError("upload:create", createError?.code);
    return { status: "error", message: GENERIC_FAILURE_MESSAGE };
  }

  const result = created[0];
  if (!result) {
    return { status: "error", message: GENERIC_FAILURE_MESSAGE };
  }

  const suggestedMapping = preset
    ? {
        dateColumn: preset.mapping.dateColumn,
        ...(preset.mapping.valueDateColumn
          ? { valueDateColumn: preset.mapping.valueDateColumn }
          : {}),
        descriptionColumn: preset.mapping.descriptionColumn,
        ...(preset.mapping.referenceColumn
          ? { referenceColumn: preset.mapping.referenceColumn }
          : {}),
        ...(preset.mapping.debitColumn
          ? { debitColumn: preset.mapping.debitColumn }
          : {}),
        ...(preset.mapping.creditColumn
          ? { creditColumn: preset.mapping.creditColumn }
          : {}),
        ...(preset.mapping.amountColumn
          ? { amountColumn: preset.mapping.amountColumn }
          : {}),
        ...(preset.mapping.balanceColumn
          ? { balanceColumn: preset.mapping.balanceColumn }
          : {}),
      }
    : heuristic.suggested;

  return {
    status: "success",
    importId: result.import_id,
    isDuplicateFile: result.is_duplicate_file,
    existingImportId: result.existing_import_id,
    currency: account.currency,
    header: tokenized.header,
    rows: tokenized.rows,
    suggestedMapping,
    detectionConfidence: preset ? "high" : heuristic.confidence,
    detectionReasons: heuristic.reasons,
  };
}

// ---------------------------------------------------------------------
// Mapping confirmation
// ---------------------------------------------------------------------

const rowsPayloadSchema = z.object({
  header: z.array(z.string()).max(60),
  rows: z
    .array(
      z.object({
        rowIndex: z.number().int().min(0),
        cells: z.array(z.string()).max(60),
      }),
    )
    .max(MAX_STATEMENT_IMPORT_ROWS),
});

/**
 * Normalizes every row with the confirmed mapping, inserts the staging
 * rows, then runs the deterministic duplicate/match/rule analysis pass
 * before handing off to the review screen. The raw rows this trusts were
 * already security-screened once in uploadStatementAction (control
 * characters stripped, size/row/column caps enforced, formula-leading
 * text neutralized happens again here in normalize.ts regardless) — round-
 * tripping them through the client cannot reintroduce anything unsafe,
 * since every value downstream is either strictly regex-parsed into a
 * typed Money/date or rejected as a validation error, never executed or
 * trusted as-is.
 */
export async function confirmMappingAction(
  _prevState: BankImportActionState,
  formData: FormData,
): Promise<BankImportActionState> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { status: "error", message: NOT_SIGNED_IN_MESSAGE };
  }

  const parsed = columnMappingSchema.safeParse({
    importId: readFormString(formData, "importId"),
    dateColumn: readFormString(formData, "dateColumn"),
    descriptionColumn: readFormString(formData, "descriptionColumn"),
    dateFormat: readFormString(formData, "dateFormat"),
    valueDateColumn: readFormString(formData, "valueDateColumn"),
    referenceColumn: readFormString(formData, "referenceColumn"),
    debitColumn: readFormString(formData, "debitColumn"),
    creditColumn: readFormString(formData, "creditColumn"),
    amountColumn: readFormString(formData, "amountColumn"),
    transactionTypeColumn: readFormString(formData, "transactionTypeColumn"),
    balanceColumn: readFormString(formData, "balanceColumn"),
    amountSignConvention:
      readFormString(formData, "amountSignConvention") || "debit_negative",
    saveAsPreset: readFormString(formData, "saveAsPreset"),
    bankLabel: readFormString(formData, "bankLabel"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  const rawPayload = readFormString(formData, "rowsPayload");
  let payload: { header: string[]; rows: RawParsedRow[] };
  try {
    payload = rowsPayloadSchema.parse(JSON.parse(rawPayload));
  } catch {
    return {
      status: "error",
      message: "Your upload session expired. Please upload the file again.",
    };
  }

  const supabase = await createSupabaseServerClient();

  const { data: importRow, error: mappingError } = await supabase.rpc(
    "apply_statement_import_mapping",
    {
      p_import_id: parsed.data.importId,
      p_date_column: parsed.data.dateColumn,
      p_description_column: parsed.data.descriptionColumn,
      p_date_format: parsed.data.dateFormat,
      ...(parsed.data.valueDateColumn
        ? { p_value_date_column: parsed.data.valueDateColumn }
        : {}),
      ...(parsed.data.referenceColumn
        ? { p_reference_column: parsed.data.referenceColumn }
        : {}),
      ...(parsed.data.debitColumn
        ? { p_debit_column: parsed.data.debitColumn }
        : {}),
      ...(parsed.data.creditColumn
        ? { p_credit_column: parsed.data.creditColumn }
        : {}),
      ...(parsed.data.amountColumn
        ? { p_amount_column: parsed.data.amountColumn }
        : {}),
      p_amount_sign_convention: parsed.data.amountSignConvention,
    },
  );

  if (mappingError || !importRow) {
    logImportError("mapping:apply", mappingError?.code);
    return { status: "error", message: GENERIC_FAILURE_MESSAGE };
  }

  if (parsed.data.saveAsPreset) {
    await supabase.rpc("save_statement_column_mapping", {
      p_header_fingerprint: importRow.header_fingerprint,
      p_date_column: parsed.data.dateColumn,
      p_description_column: parsed.data.descriptionColumn,
      p_date_format: parsed.data.dateFormat,
      ...(parsed.data.bankLabel ? { p_bank_label: parsed.data.bankLabel } : {}),
      ...(parsed.data.valueDateColumn
        ? { p_value_date_column: parsed.data.valueDateColumn }
        : {}),
      ...(parsed.data.referenceColumn
        ? { p_reference_column: parsed.data.referenceColumn }
        : {}),
      ...(parsed.data.debitColumn
        ? { p_debit_column: parsed.data.debitColumn }
        : {}),
      ...(parsed.data.creditColumn
        ? { p_credit_column: parsed.data.creditColumn }
        : {}),
      ...(parsed.data.amountColumn
        ? { p_amount_column: parsed.data.amountColumn }
        : {}),
      p_amount_sign_convention: parsed.data.amountSignConvention,
    });
  }

  const { data: account, error: accountError } = await supabase
    .from("accounts")
    .select("account_type")
    .eq("id", importRow.account_id)
    .maybeSingle();
  if (accountError || !account) {
    logImportError("mapping:account", accountError?.code);
    return { status: "error", message: GENERIC_FAILURE_MESSAGE };
  }
  const accountType = account.account_type as UserAccountType;

  const mapping: StatementColumnMapping = {
    dateColumn: parsed.data.dateColumn,
    ...(parsed.data.valueDateColumn
      ? { valueDateColumn: parsed.data.valueDateColumn }
      : {}),
    descriptionColumn: parsed.data.descriptionColumn,
    ...(parsed.data.referenceColumn
      ? { referenceColumn: parsed.data.referenceColumn }
      : {}),
    ...(parsed.data.debitColumn
      ? { debitColumn: parsed.data.debitColumn }
      : {}),
    ...(parsed.data.creditColumn
      ? { creditColumn: parsed.data.creditColumn }
      : {}),
    ...(parsed.data.amountColumn
      ? { amountColumn: parsed.data.amountColumn }
      : {}),
    dateFormat: parsed.data.dateFormat,
    amountSignConvention: parsed.data.amountSignConvention,
  };
  const amountShape = amountShapeForMapping(mapping);
  const today = nowAsIstCalendarDate();

  const normalizedRows = payload.rows.map((rawRow) =>
    normalizeStatementRow({
      rawRow,
      header: payload.header,
      mapping,
      amountShape,
      todayIstDate: today,
      importCurrency: importRow.currency,
    }),
  );

  const insertPayload = normalizedRows.map((row) => ({
    row_index: row.rowIndex,
    row_hash: row.rowHash,
    transaction_date: row.transactionDate,
    value_date: row.valueDate,
    description: row.description,
    reference: row.reference,
    cheque_number: row.chequeNumber,
    amount: row.amount ? toDbAmountString(row.amount) : null,
    direction: row.direction,
    running_balance: row.runningBalance
      ? toDbAmountString(row.runningBalance)
      : null,
    currency: row.currency,
    suggested_transaction_type: row.direction
      ? inferBaseTransactionType(row.direction, accountType)
      : null,
    validation_errors: row.validationErrors,
  }));

  const { error: insertError } = await supabase.rpc(
    "insert_statement_import_rows",
    {
      p_import_id: parsed.data.importId,
      p_rows: insertPayload,
    },
  );

  if (insertError) {
    logImportError("mapping:insert-rows", insertError.code);
    return { status: "error", message: GENERIC_FAILURE_MESSAGE };
  }

  await runRowAnalysis(supabase, parsed.data.importId, importRow.currency);

  redirect(`/app/import/${parsed.data.importId}/review`);
}

type InsertedRowForAnalysis = {
  id: string;
  account_id: string;
  transaction_date: string | null;
  description: string;
  reference: string | null;
  amount: number | null;
  direction: string | null;
  suggested_transaction_type: string | null;
};

/** JSON-compatible mirrors of apply_statement_import_row_analysis's p_row_updates / p_matches element shapes. */
type RowAnalysisUpdatePayload = {
  row_id: string;
  duplicate_status?: string;
  match_status?: string;
  resolved_transaction_type?: string;
  suggested_category_id?: string;
  suggested_payee_id?: string;
  matched_rule_id?: string;
  has_rule_conflict?: boolean;
  user_decision?: string;
};

type RowAnalysisMatchPayload = {
  row_id: string;
  match_kind: "existing_transaction" | "transfer_row";
  candidate_transaction_id?: string;
  candidate_row_id?: string;
  score: number;
  confidence: string;
  reasons: string[];
  conflicts: string[];
};

/**
 * The deterministic duplicate/match/rule analysis pass — pure scoring
 * (matching.ts) plus pure rule evaluation (rules.ts) over data fetched via
 * bounded, indexed queries, written back through the one ownership-
 * revalidating RPC (apply_statement_import_row_analysis). Never invoked
 * with anything the caller hasn't already confirmed belongs to this
 * import — row ids here always come from a fresh, RLS-scoped select.
 */
async function runRowAnalysis(
  supabase: SupabaseClient<Database>,
  importId: string,
  currency: string,
): Promise<void> {
  const { data: insertedRows } = await supabase
    .from("statement_import_rows")
    .select(
      "id, account_id, transaction_date, description, reference, amount, direction, suggested_transaction_type",
    )
    .eq("import_id", importId)
    .neq("duplicate_status", "exact_row_duplicate")
    .order("row_index", { ascending: true });

  const rows = (insertedRows ?? []) as InsertedRowForAnalysis[];
  if (rows.length === 0) {
    await supabase.rpc("apply_statement_import_row_analysis", {
      p_import_id: importId,
      p_row_updates: [],
      p_matches: [],
    });
    return;
  }

  const rules = await listImportRules(supabase);
  const rowUpdates: RowAnalysisUpdatePayload[] = [];
  const matches: RowAnalysisMatchPayload[] = [];

  for (const row of rows) {
    if (!row.transaction_date || row.amount === null || !row.direction) {
      continue;
    }
    const transactionDate = row.transaction_date;
    const direction: RowDirection =
      row.direction === "debit" ? "debit" : "credit";
    const amount = new Decimal(row.amount).abs();

    let duplicateStatus: string | undefined;
    let matchStatus: string | undefined;

    const existingCandidates = await findExistingTransactionCandidates(
      supabase,
      {
        accountId: row.account_id,
        transactionDate,
        windowDays: MATCH_DATE_WINDOW_DAYS,
      },
    );
    const scoredExisting = [];
    for (const candidate of existingCandidates) {
      const scored = scoreExistingTransactionCandidate({
        rowDate: transactionDate,
        rowAmount: amount,
        rowDirection: direction,
        rowDescription: row.description,
        rowReference: row.reference,
        candidate,
        dateWindowDays: MATCH_DATE_WINDOW_DAYS,
      });
      if (scored) {
        scoredExisting.push({
          ...scored,
          candidateTransactionId: candidate.transactionId,
        });
      }
    }
    const topExisting = rankCandidates(scoredExisting, 3);

    const bestExisting = topExisting[0];
    if (bestExisting && bestExisting.score >= 0.9) {
      duplicateStatus = "existing_transaction_match";
      matchStatus = "existing_match_candidate";
    } else if (bestExisting) {
      duplicateStatus = "possible_duplicate";
      matchStatus = "existing_match_candidate";
    }
    for (const scored of topExisting) {
      matches.push({
        row_id: row.id,
        match_kind: "existing_transaction",
        candidate_transaction_id: scored.candidateTransactionId,
        score: scored.score,
        confidence: scored.confidence,
        reasons: scored.reasons,
        conflicts: scored.conflicts,
      });
    }

    if (!matchStatus) {
      const transferCandidates = await findTransferCandidateRows(supabase, {
        excludeAccountId: row.account_id,
        currency,
        transactionDate,
        windowDays: MATCH_DATE_WINDOW_DAYS,
      });
      const scoredTransfers = [];
      for (const candidate of transferCandidates) {
        const scored = scoreTransferCandidate({
          rowDate: transactionDate,
          rowAmount: amount,
          rowDirection: direction,
          rowAccountId: row.account_id,
          rowCurrency: currency,
          rowDescription: row.description,
          rowReference: row.reference,
          candidateDate: candidate.transactionDate,
          candidateAmount: candidate.amount,
          candidateDirection: candidate.direction,
          candidateAccountId: candidate.accountId,
          candidateCurrency: candidate.currency,
          candidateDescription: candidate.description,
          candidateReference: candidate.reference,
          dateWindowDays: MATCH_DATE_WINDOW_DAYS,
        });
        if (scored) {
          scoredTransfers.push({ ...scored, candidateRowId: candidate.rowId });
        }
      }
      const topTransfers = rankCandidates(scoredTransfers, 3);
      if (topTransfers.length > 0) {
        matchStatus = "transfer_candidate";
      }
      for (const scored of topTransfers) {
        matches.push({
          row_id: row.id,
          match_kind: "transfer_row",
          candidate_row_id: scored.candidateRowId,
          score: scored.score,
          confidence: scored.confidence,
          reasons: scored.reasons,
          conflicts: scored.conflicts,
        });
      }
    }

    const ruleResult = evaluateImportRules(
      {
        description: row.description,
        reference: row.reference,
        direction,
        accountId: row.account_id,
        amount,
      },
      rules,
    );

    const baseSuggested =
      row.suggested_transaction_type as ImportableTransactionType | null;
    let resolvedType: ImportableTransactionType | null = baseSuggested;
    let categoryId: string | undefined;
    let payeeId: string | undefined;
    let matchedRuleId: string | undefined;
    let userDecision: string | undefined;
    // True only when more than one active rule tied for this row's
    // highest matched priority AND those rules disagreed on what to
    // suggest — see evaluateImportRules's "conflict" case. The row is
    // deliberately left without a rule-derived suggestion in that case
    // (never guess which of the tied rules should win); this flag is what
    // lets the review UI surface the ambiguity instead of it silently
    // looking identical to "no rule matched at all".
    const hasRuleConflict = ruleResult.status === "conflict";

    if (ruleResult.status === "matched") {
      const rule: ImportRule = ruleResult.rule;
      matchedRuleId = rule.id;
      if (rule.suggestedTransactionType) {
        resolvedType = rule.suggestedTransactionType;
      }
      if (rule.suggestedCategoryId) {
        categoryId = rule.suggestedCategoryId;
      }
      if (rule.suggestedPayeeId) {
        payeeId = rule.suggestedPayeeId;
      }
      if (rule.exclude) {
        userDecision = "exclude";
      }
    }

    rowUpdates.push({
      row_id: row.id,
      ...(duplicateStatus ? { duplicate_status: duplicateStatus } : {}),
      ...(matchStatus ? { match_status: matchStatus } : {}),
      ...(resolvedType ? { resolved_transaction_type: resolvedType } : {}),
      ...(categoryId ? { suggested_category_id: categoryId } : {}),
      ...(payeeId ? { suggested_payee_id: payeeId } : {}),
      ...(matchedRuleId ? { matched_rule_id: matchedRuleId } : {}),
      ...(hasRuleConflict ? { has_rule_conflict: true } : {}),
      ...(userDecision ? { user_decision: userDecision } : {}),
    });
  }

  await supabase.rpc("apply_statement_import_row_analysis", {
    p_import_id: importId,
    p_row_updates: rowUpdates,
    p_matches: matches,
  });
}

// ---------------------------------------------------------------------
// Review-stage edits
// ---------------------------------------------------------------------

export async function updateImportRowAction(
  _prevState: BankImportActionState,
  formData: FormData,
): Promise<BankImportActionState> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { status: "error", message: NOT_SIGNED_IN_MESSAGE };
  }

  const parsed = updateRowSchema.safeParse({
    rowId: readFormString(formData, "rowId"),
    userDecision: readFormString(formData, "userDecision") || undefined,
    categoryId: readFormString(formData, "categoryId"),
    payeeId: readFormString(formData, "payeeId"),
    resolvedTransactionType:
      readFormString(formData, "resolvedTransactionType") || undefined,
    counterpartyAccountId: readFormString(formData, "counterpartyAccountId"),
    notes: readFormString(formData, "notes"),
    walletId: readFormString(formData, "walletId"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("update_statement_import_row", {
    p_row_id: parsed.data.rowId,
    ...(parsed.data.userDecision
      ? { p_user_decision: parsed.data.userDecision }
      : {}),
    ...(parsed.data.categoryId
      ? { p_category_id: parsed.data.categoryId }
      : {}),
    ...(parsed.data.payeeId ? { p_payee_id: parsed.data.payeeId } : {}),
    ...(parsed.data.resolvedTransactionType
      ? { p_resolved_transaction_type: parsed.data.resolvedTransactionType }
      : {}),
    ...(parsed.data.counterpartyAccountId
      ? { p_counterparty_account_id: parsed.data.counterpartyAccountId }
      : {}),
    ...(parsed.data.notes ? { p_notes: parsed.data.notes } : {}),
    ...(parsed.data.walletId ? { p_wallet_id: parsed.data.walletId } : {}),
  });

  if (error) {
    logImportError("row:update", error.code);
    return { status: "error", message: GENERIC_FAILURE_MESSAGE };
  }
  return { status: "success", message: "Row updated." };
}

export async function bulkUpdateImportRowsAction(
  _prevState: BankImportActionState,
  formData: FormData,
): Promise<BankImportActionState> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { status: "error", message: NOT_SIGNED_IN_MESSAGE };
  }

  const rowIdsRaw = formData
    .getAll("rowIds")
    .filter((v): v is string => typeof v === "string");
  const parsed = bulkUpdateRowsSchema.safeParse({
    importId: readFormString(formData, "importId"),
    rowIds: rowIdsRaw,
    userDecision: readFormString(formData, "userDecision") || undefined,
    categoryId: readFormString(formData, "categoryId"),
    payeeId: readFormString(formData, "payeeId"),
    walletId: readFormString(formData, "walletId"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: "Select at least one row and an action.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("bulk_update_statement_import_rows", {
    p_import_id: parsed.data.importId,
    p_row_ids: parsed.data.rowIds,
    ...(parsed.data.userDecision
      ? { p_user_decision: parsed.data.userDecision }
      : {}),
    ...(parsed.data.categoryId
      ? { p_category_id: parsed.data.categoryId }
      : {}),
    ...(parsed.data.payeeId ? { p_payee_id: parsed.data.payeeId } : {}),
    ...(parsed.data.walletId ? { p_wallet_id: parsed.data.walletId } : {}),
  });

  if (error) {
    logImportError("row:bulk-update", error.code);
    return { status: "error", message: GENERIC_FAILURE_MESSAGE };
  }
  return { status: "success", message: "Rows updated." };
}

export async function linkExistingTransactionAction(
  _prevState: BankImportActionState,
  formData: FormData,
): Promise<BankImportActionState> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { status: "error", message: NOT_SIGNED_IN_MESSAGE };
  }

  const parsed = linkExistingTransactionSchema.safeParse({
    rowId: readFormString(formData, "rowId"),
    transactionId: readFormString(formData, "transactionId"),
  });
  if (!parsed.success) {
    return { status: "error", message: "Choose a valid transaction to link." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc(
    "link_statement_import_row_to_transaction",
    {
      p_row_id: parsed.data.rowId,
      p_transaction_id: parsed.data.transactionId,
    },
  );

  if (error) {
    logImportError("row:link", error.code);
    return { status: "error", message: GENERIC_FAILURE_MESSAGE };
  }
  return { status: "success", message: "Linked to the existing transaction." };
}

export async function unlinkImportRowAction(
  _prevState: BankImportActionState,
  formData: FormData,
): Promise<BankImportActionState> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { status: "error", message: NOT_SIGNED_IN_MESSAGE };
  }
  const rowId = readFormString(formData, "rowId");
  if (!rowId) {
    return { status: "error", message: GENERIC_FAILURE_MESSAGE };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("unlink_statement_import_row", {
    p_row_id: rowId,
  });
  if (error) {
    logImportError("row:unlink", error.code);
    return { status: "error", message: GENERIC_FAILURE_MESSAGE };
  }
  return { status: "success", message: "Link removed." };
}

export async function confirmTransferMatchAction(
  _prevState: BankImportActionState,
  formData: FormData,
): Promise<BankImportActionState> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { status: "error", message: NOT_SIGNED_IN_MESSAGE };
  }

  const parsed = confirmTransferMatchSchema.safeParse({
    rowId: readFormString(formData, "rowId"),
    candidateRowId: readFormString(formData, "candidateRowId"),
  });
  if (!parsed.success) {
    return { status: "error", message: "Choose a valid transfer counterpart." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("confirm_statement_transfer_match", {
    p_row_id: parsed.data.rowId,
    p_candidate_row_id: parsed.data.candidateRowId,
  });

  if (error) {
    logImportError("row:confirm-transfer", error.code);
    return {
      status: "error",
      message:
        "These two rows can't be linked as a transfer — check that the amounts, accounts, and directions match.",
    };
  }
  return { status: "success", message: "Transfer match confirmed." };
}

// ---------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------

export async function markImportReadyAction(
  _prevState: BankImportActionState,
  formData: FormData,
): Promise<BankImportActionState> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { status: "error", message: NOT_SIGNED_IN_MESSAGE };
  }
  const importId = readFormString(formData, "importId");
  if (!importId) {
    return { status: "error", message: GENERIC_FAILURE_MESSAGE };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("mark_statement_import_ready", {
    p_import_id: importId,
  });
  if (error) {
    logImportError("import:ready", error.code);
    return { status: "error", message: GENERIC_FAILURE_MESSAGE };
  }
  redirect(`/app/import/${importId}/reconcile`);
}

export async function revertImportToReviewingAction(
  _prevState: BankImportActionState,
  formData: FormData,
): Promise<BankImportActionState> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { status: "error", message: NOT_SIGNED_IN_MESSAGE };
  }
  const importId = readFormString(formData, "importId");
  if (!importId) {
    return { status: "error", message: GENERIC_FAILURE_MESSAGE };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("revert_statement_import_to_reviewing", {
    p_import_id: importId,
  });
  if (error) {
    logImportError("import:revert", error.code);
    return { status: "error", message: GENERIC_FAILURE_MESSAGE };
  }
  redirect(`/app/import/${importId}/review`);
}

export async function discardImportAction(
  _prevState: BankImportActionState,
  formData: FormData,
): Promise<BankImportActionState> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { status: "error", message: NOT_SIGNED_IN_MESSAGE };
  }
  const importId = readFormString(formData, "importId");
  if (!importId) {
    return { status: "error", message: GENERIC_FAILURE_MESSAGE };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("discard_statement_import", {
    p_import_id: importId,
  });
  if (error) {
    logImportError("import:discard", error.code);
    return {
      status: "error",
      message:
        "This import can't be discarded — it may already have posted transactions.",
    };
  }
  redirect("/app/import/history");
}

export async function saveReconciliationBalancesAction(
  _prevState: BankImportActionState,
  formData: FormData,
): Promise<BankImportActionState> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { status: "error", message: NOT_SIGNED_IN_MESSAGE };
  }

  const parsed = reconciliationBalancesSchema.safeParse({
    importId: readFormString(formData, "importId"),
    openingBalance: readFormString(formData, "openingBalance"),
    closingBalance: readFormString(formData, "closingBalance"),
  });
  if (!parsed.success) {
    return { status: "error", message: GENERIC_FAILURE_MESSAGE };
  }

  // These are reconciliation display/comparison values on
  // statement_imports (a plain numeric column, not a ledger entry
  // contributing to the sum-to-zero invariant) — going through
  // PostgREST's typed update() requires a JS number here, unlike a posted
  // amount, which always travels as an exact decimal string (see
  // toDbAmountString / entry-builder.ts).
  let openingValue: number | null = null;
  if (parsed.data.openingBalance) {
    const cell = parseStatementAmountCell(parsed.data.openingBalance);
    if (cell.kind !== "value") {
      return {
        status: "error",
        message: "Enter a valid opening balance.",
        fieldErrors: { openingBalance: "Enter a valid amount." },
      };
    }
    const magnitude =
      cell.explicitSign === "negative"
        ? cell.magnitude.negated()
        : cell.magnitude;
    openingValue = magnitude.toNumber();
  }

  let closingValue: number | null = null;
  if (parsed.data.closingBalance) {
    const cell = parseStatementAmountCell(parsed.data.closingBalance);
    if (cell.kind !== "value") {
      return {
        status: "error",
        message: "Enter a valid closing balance.",
        fieldErrors: { closingBalance: "Enter a valid amount." },
      };
    }
    const magnitude =
      cell.explicitSign === "negative"
        ? cell.magnitude.negated()
        : cell.magnitude;
    closingValue = magnitude.toNumber();
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("statement_imports")
    .update({
      opening_balance: openingValue,
      closing_balance: closingValue,
    })
    .eq("id", parsed.data.importId);

  if (error) {
    logImportError("import:balances", error.code);
    return {
      status: "error",
      message:
        "Statement balances can only be edited before posting — this import may already be posting or completed.",
    };
  }
  return { status: "success", message: "Balances saved." };
}

export async function postImportBatchAction(
  _prevState: BankImportActionState,
  formData: FormData,
): Promise<BankImportActionState> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { status: "error", message: NOT_SIGNED_IN_MESSAGE };
  }
  const importId = readFormString(formData, "importId");
  if (!importId) {
    return { status: "error", message: GENERIC_FAILURE_MESSAGE };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("post_statement_import_batch", {
    p_import_id: importId,
  });

  if (error || !data || data.length === 0) {
    logImportError("import:post", error?.code);
    return { status: "error", message: GENERIC_FAILURE_MESSAGE };
  }

  const result = data[0];
  if (!result?.success) {
    return {
      status: "error",
      message:
        "Posting failed and nothing was recorded — the import has been marked as failed so you can retry.",
    };
  }

  redirect(`/app/import/${importId}?posted=1`);
}

// ---------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------

export async function saveImportRuleAction(
  _prevState: BankImportActionState,
  formData: FormData,
): Promise<BankImportActionState> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { status: "error", message: NOT_SIGNED_IN_MESSAGE };
  }

  const parsed = saveImportRuleSchema.safeParse({
    ruleId: readFormString(formData, "ruleId"),
    name: readFormString(formData, "name"),
    matchField: readFormString(formData, "matchField"),
    matchValue: readFormString(formData, "matchValue"),
    directionFilter: readFormString(formData, "directionFilter"),
    accountId: readFormString(formData, "accountId"),
    minAmount: readFormString(formData, "minAmount"),
    maxAmount: readFormString(formData, "maxAmount"),
    suggestedTransactionType: readFormString(
      formData,
      "suggestedTransactionType",
    ),
    suggestedCategoryId: readFormString(formData, "suggestedCategoryId"),
    suggestedPayeeId: readFormString(formData, "suggestedPayeeId"),
    notesTemplate: readFormString(formData, "notesTemplate"),
    exclude: readFormString(formData, "exclude"),
    priority: readFormString(formData, "priority"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("save_statement_import_rule", {
    ...(parsed.data.ruleId ? { p_rule_id: parsed.data.ruleId } : {}),
    p_name: parsed.data.name,
    p_match_field: parsed.data.matchField,
    p_match_value: parsed.data.matchValue,
    ...(parsed.data.directionFilter
      ? { p_direction_filter: parsed.data.directionFilter }
      : {}),
    ...(parsed.data.accountId ? { p_account_id: parsed.data.accountId } : {}),
    // Rule thresholds are a coarse categorization filter, never a posted
    // ledger amount — converting to a JS number here carries no financial
    // consequence (see money/parse.ts's toDbAmountString, used everywhere
    // an actual entry amount is sent to the database instead).
    ...(parsed.data.minAmount
      ? { p_min_amount: parsed.data.minAmount.toNumber() }
      : {}),
    ...(parsed.data.maxAmount
      ? { p_max_amount: parsed.data.maxAmount.toNumber() }
      : {}),
    ...(parsed.data.suggestedTransactionType
      ? { p_suggested_transaction_type: parsed.data.suggestedTransactionType }
      : {}),
    ...(parsed.data.suggestedCategoryId
      ? { p_suggested_category_id: parsed.data.suggestedCategoryId }
      : {}),
    ...(parsed.data.suggestedPayeeId
      ? { p_suggested_payee_id: parsed.data.suggestedPayeeId }
      : {}),
    ...(parsed.data.notesTemplate
      ? { p_notes_template: parsed.data.notesTemplate }
      : {}),
    p_exclude: parsed.data.exclude,
    p_priority: parsed.data.priority,
  });

  if (error) {
    logImportError("rule:save", error.code);
    return { status: "error", message: GENERIC_FAILURE_MESSAGE };
  }
  return { status: "success", message: "Rule saved." };
}

export async function deleteImportRuleAction(
  _prevState: BankImportActionState,
  formData: FormData,
): Promise<BankImportActionState> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { status: "error", message: NOT_SIGNED_IN_MESSAGE };
  }
  const ruleId = readFormString(formData, "ruleId");
  if (!ruleId) {
    return { status: "error", message: GENERIC_FAILURE_MESSAGE };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("delete_statement_import_rule", {
    p_rule_id: ruleId,
  });
  if (error) {
    logImportError("rule:delete", error.code);
    return { status: "error", message: GENERIC_FAILURE_MESSAGE };
  }
  return { status: "success", message: "Rule deleted." };
}
