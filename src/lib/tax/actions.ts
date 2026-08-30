"use server";

import { revalidatePath } from "next/cache";
import type { z } from "zod";

import { getAuthenticatedUser } from "@/lib/auth/session";
import { getCapitalGainsReportForYear } from "@/lib/tax/capital-gains-data";
import {
  isValidFinancialYearId,
  parseFinancialYearId,
} from "@/lib/tax/financial-year";
import {
  getLatestFinalizedTaxReportSnapshot,
  listTaxDeductions,
  listTaxIncomeAdjustments,
  listTaxPayments,
  listTaxReconciliationItems,
  listTaxWithholdings,
} from "@/lib/tax/queries";
import {
  getRegimeComparisonForYear,
  type RegimeComparisonAvailability,
} from "@/lib/tax/regime-comparison-data";
import { getTaxRuleSet } from "@/lib/tax/rules/registry";
import { serializeForSnapshot } from "@/lib/tax/snapshot";
import type { TaxActionState } from "@/lib/tax/action-state";
import {
  taxAssetClassificationSchema,
  taxDeductionSchema,
  taxIncomeAdjustmentSchema,
  taxPaymentSchema,
  taxProfileSchema,
  taxReconciliationItemSchema,
  taxWithholdingSchema,
  withholdingReconciliationStatusSchema,
} from "@/lib/tax/schema";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database.types";

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

/** Logs only a Postgrest error code, never its message (which can echo back data). */
function logTaxError(context: string, code: string | undefined): void {
  if (process.env.NODE_ENV === "production") {
    return;
  }
  console.error(`[tax:${context}]`, { code: code ?? "unknown" });
}

const NOT_SIGNED_IN_MESSAGE = "You need to sign in again to manage tax data.";
const GENERIC_FAILED_MESSAGE = "That didn't work. Please try again.";

function revalidateFinancialYear(financialYearId: string): void {
  revalidatePath(`/app/tax/${financialYearId}`);
  revalidatePath("/app/tax");
}

export async function saveTaxProfileAction(
  _prevState: TaxActionState,
  formData: FormData,
): Promise<TaxActionState> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { status: "error", message: NOT_SIGNED_IN_MESSAGE };
  }

  const parsed = taxProfileSchema.safeParse({
    residentialStatus: readFormString(formData, "residentialStatus"),
    hasBusinessOrProfessionalIncome: readFormString(
      formData,
      "hasBusinessOrProfessionalIncome",
    ),
    hasSalaryOrPensionIncome: readFormString(
      formData,
      "hasSalaryOrPensionIncome",
    ),
    defaultRegimePreference: readFormString(
      formData,
      "defaultRegimePreference",
    ),
    ageBand: readFormString(formData, "ageBand"),
    maskedPanLabel: readFormString(formData, "maskedPanLabel"),
    notes: readFormString(formData, "notes"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("save_tax_profile", {
    p_residential_status: parsed.data.residentialStatus,
    p_has_business_or_professional_income:
      parsed.data.hasBusinessOrProfessionalIncome,
    p_has_salary_or_pension_income: parsed.data.hasSalaryOrPensionIncome,
    ...(parsed.data.defaultRegimePreference
      ? { p_default_regime_preference: parsed.data.defaultRegimePreference }
      : {}),
    ...(parsed.data.ageBand ? { p_age_band: parsed.data.ageBand } : {}),
    ...(parsed.data.maskedPanLabel
      ? { p_masked_pan_label: parsed.data.maskedPanLabel }
      : {}),
    ...(parsed.data.notes ? { p_notes: parsed.data.notes } : {}),
  });

  if (error) {
    logTaxError("profile", error.code);
    return { status: "error", message: GENERIC_FAILED_MESSAGE };
  }

  revalidatePath("/app/tax");
  revalidatePath("/app/tax/profile");

  return { status: "success", message: "Tax profile saved." };
}

export async function saveTaxIncomeAdjustmentAction(
  _prevState: TaxActionState,
  formData: FormData,
): Promise<TaxActionState> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { status: "error", message: NOT_SIGNED_IN_MESSAGE };
  }

  const parsed = taxIncomeAdjustmentSchema.safeParse({
    financialYearId: readFormString(formData, "financialYearId"),
    category: readFormString(formData, "category"),
    grossAmount: readFormString(formData, "grossAmount"),
    tdsAmount: readFormString(formData, "tdsAmount"),
    isExemptCandidate: readFormString(formData, "isExemptCandidate"),
    sourceType: readFormString(formData, "sourceType") || "manual",
    sourceLedgerTransactionId: readFormString(
      formData,
      "sourceLedgerTransactionId",
    ),
    sourceInvestmentActivityId: readFormString(
      formData,
      "sourceInvestmentActivityId",
    ),
    evidenceLabel: readFormString(formData, "evidenceLabel"),
    notes: readFormString(formData, "notes"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("save_tax_income_adjustment", {
    p_financial_year_id: parsed.data.financialYearId,
    p_category: parsed.data.category,
    p_gross_amount: parsed.data.grossAmount.toNumber(),
    ...(parsed.data.tdsAmount !== undefined
      ? { p_tds_amount: parsed.data.tdsAmount.toNumber() }
      : {}),
    p_is_exempt_candidate: parsed.data.isExemptCandidate,
    p_source_type: parsed.data.sourceType,
    ...(parsed.data.sourceLedgerTransactionId
      ? {
          p_source_ledger_transaction_id: parsed.data.sourceLedgerTransactionId,
        }
      : {}),
    ...(parsed.data.sourceInvestmentActivityId
      ? {
          p_source_investment_activity_id:
            parsed.data.sourceInvestmentActivityId,
        }
      : {}),
    ...(parsed.data.evidenceLabel
      ? { p_evidence_label: parsed.data.evidenceLabel }
      : {}),
    ...(parsed.data.notes ? { p_notes: parsed.data.notes } : {}),
  });

  if (error) {
    logTaxError("income-adjustment", error.code);
    return {
      status: "error",
      message:
        error.code === "23505"
          ? "That transaction or activity is already classified."
          : GENERIC_FAILED_MESSAGE,
    };
  }

  revalidateFinancialYear(parsed.data.financialYearId);
  return { status: "success", message: "Income classification saved." };
}

export async function setTaxIncomeAdjustmentStatusAction(
  _prevState: TaxActionState,
  formData: FormData,
): Promise<TaxActionState> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { status: "error", message: NOT_SIGNED_IN_MESSAGE };
  }

  const id = readFormString(formData, "id");
  const status = readFormString(formData, "status");
  const financialYearId = readFormString(formData, "financialYearId");
  if (!id || !status) {
    return { status: "error", message: GENERIC_FAILED_MESSAGE };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("set_tax_income_adjustment_status", {
    p_id: id,
    p_status: status,
  });

  if (error) {
    logTaxError("income-adjustment-status", error.code);
    return { status: "error", message: GENERIC_FAILED_MESSAGE };
  }

  if (financialYearId) {
    revalidateFinancialYear(financialYearId);
  }
  return { status: "success", message: "Status updated." };
}

export async function deleteTaxIncomeAdjustmentAction(
  _prevState: TaxActionState,
  formData: FormData,
): Promise<TaxActionState> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { status: "error", message: NOT_SIGNED_IN_MESSAGE };
  }

  const id = readFormString(formData, "id");
  const financialYearId = readFormString(formData, "financialYearId");
  if (!id) {
    return { status: "error", message: GENERIC_FAILED_MESSAGE };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("delete_tax_income_adjustment", {
    p_id: id,
  });

  if (error) {
    logTaxError("income-adjustment-delete", error.code);
    return { status: "error", message: GENERIC_FAILED_MESSAGE };
  }

  if (financialYearId) {
    revalidateFinancialYear(financialYearId);
  }
  return { status: "success", message: "Income classification removed." };
}

export async function saveTaxDeductionAction(
  _prevState: TaxActionState,
  formData: FormData,
): Promise<TaxActionState> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { status: "error", message: NOT_SIGNED_IN_MESSAGE };
  }

  const deductionId = readFormString(formData, "deductionId") || undefined;
  const parsed = taxDeductionSchema.safeParse({
    financialYearId: readFormString(formData, "financialYearId"),
    section: readFormString(formData, "section"),
    claimedAmount: readFormString(formData, "claimedAmount"),
    evidenceLabel: readFormString(formData, "evidenceLabel"),
    maskedReference: readFormString(formData, "maskedReference"),
    sourceUrl: readFormString(formData, "sourceUrl"),
    notes: readFormString(formData, "notes"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("save_tax_deduction", {
    p_financial_year_id: parsed.data.financialYearId,
    p_section: parsed.data.section,
    p_claimed_amount: parsed.data.claimedAmount.toNumber(),
    ...(parsed.data.evidenceLabel
      ? { p_evidence_label: parsed.data.evidenceLabel }
      : {}),
    ...(parsed.data.maskedReference
      ? { p_masked_reference: parsed.data.maskedReference }
      : {}),
    ...(parsed.data.sourceUrl ? { p_source_url: parsed.data.sourceUrl } : {}),
    ...(parsed.data.notes ? { p_notes: parsed.data.notes } : {}),
    ...(deductionId ? { p_deduction_id: deductionId } : {}),
  });

  if (error) {
    logTaxError("deduction", error.code);
    return { status: "error", message: GENERIC_FAILED_MESSAGE };
  }

  revalidateFinancialYear(parsed.data.financialYearId);
  return { status: "success", message: "Deduction saved." };
}

export async function deleteTaxDeductionAction(
  _prevState: TaxActionState,
  formData: FormData,
): Promise<TaxActionState> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { status: "error", message: NOT_SIGNED_IN_MESSAGE };
  }

  const id = readFormString(formData, "id");
  const financialYearId = readFormString(formData, "financialYearId");
  if (!id) {
    return { status: "error", message: GENERIC_FAILED_MESSAGE };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("delete_tax_deduction", { p_id: id });

  if (error) {
    logTaxError("deduction-delete", error.code);
    return { status: "error", message: GENERIC_FAILED_MESSAGE };
  }

  if (financialYearId) {
    revalidateFinancialYear(financialYearId);
  }
  return { status: "success", message: "Deduction removed." };
}

export async function saveTaxWithholdingAction(
  _prevState: TaxActionState,
  formData: FormData,
): Promise<TaxActionState> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { status: "error", message: NOT_SIGNED_IN_MESSAGE };
  }

  const withholdingId = readFormString(formData, "withholdingId") || undefined;
  const parsed = taxWithholdingSchema.safeParse({
    financialYearId: readFormString(formData, "financialYearId"),
    withholdingType: readFormString(formData, "withholdingType"),
    deductorName: readFormString(formData, "deductorName"),
    grossAmount: readFormString(formData, "grossAmount"),
    taxWithheld: readFormString(formData, "taxWithheld"),
    withheldOn: readFormString(formData, "withheldOn"),
    maskedTan: readFormString(formData, "maskedTan"),
    incomeCategory: readFormString(formData, "incomeCategory"),
    referenceLabel: readFormString(formData, "referenceLabel"),
    evidenceSource: readFormString(formData, "evidenceSource"),
    notes: readFormString(formData, "notes"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("save_tax_withholding", {
    p_financial_year_id: parsed.data.financialYearId,
    p_withholding_type: parsed.data.withholdingType,
    p_deductor_name: parsed.data.deductorName,
    p_gross_amount: parsed.data.grossAmount.toNumber(),
    p_tax_withheld: parsed.data.taxWithheld.toNumber(),
    p_withheld_on: parsed.data.withheldOn,
    ...(parsed.data.maskedTan ? { p_masked_tan: parsed.data.maskedTan } : {}),
    ...(parsed.data.incomeCategory
      ? { p_income_category: parsed.data.incomeCategory }
      : {}),
    ...(parsed.data.referenceLabel
      ? { p_reference_label: parsed.data.referenceLabel }
      : {}),
    ...(parsed.data.evidenceSource
      ? { p_evidence_source: parsed.data.evidenceSource }
      : {}),
    ...(parsed.data.notes ? { p_notes: parsed.data.notes } : {}),
    ...(withholdingId ? { p_withholding_id: withholdingId } : {}),
  });

  if (error) {
    logTaxError("withholding", error.code);
    return { status: "error", message: GENERIC_FAILED_MESSAGE };
  }

  revalidateFinancialYear(parsed.data.financialYearId);
  return { status: "success", message: "TDS/TCS record saved." };
}

export async function setTaxWithholdingReconciliationStatusAction(
  _prevState: TaxActionState,
  formData: FormData,
): Promise<TaxActionState> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { status: "error", message: NOT_SIGNED_IN_MESSAGE };
  }

  const id = readFormString(formData, "id");
  const financialYearId = readFormString(formData, "financialYearId");
  const parsedStatus = withholdingReconciliationStatusSchema.safeParse(
    readFormString(formData, "status"),
  );
  if (!id || !parsedStatus.success) {
    return { status: "error", message: GENERIC_FAILED_MESSAGE };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc(
    "set_tax_withholding_reconciliation_status",
    { p_id: id, p_status: parsedStatus.data },
  );

  if (error) {
    logTaxError("withholding-status", error.code);
    return { status: "error", message: GENERIC_FAILED_MESSAGE };
  }

  if (financialYearId) {
    revalidateFinancialYear(financialYearId);
  }
  return { status: "success", message: "Status updated." };
}

export async function deleteTaxWithholdingAction(
  _prevState: TaxActionState,
  formData: FormData,
): Promise<TaxActionState> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { status: "error", message: NOT_SIGNED_IN_MESSAGE };
  }

  const id = readFormString(formData, "id");
  const financialYearId = readFormString(formData, "financialYearId");
  if (!id) {
    return { status: "error", message: GENERIC_FAILED_MESSAGE };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("delete_tax_withholding", { p_id: id });

  if (error) {
    logTaxError("withholding-delete", error.code);
    return { status: "error", message: GENERIC_FAILED_MESSAGE };
  }

  if (financialYearId) {
    revalidateFinancialYear(financialYearId);
  }
  return { status: "success", message: "TDS/TCS record removed." };
}

export async function saveTaxPaymentAction(
  _prevState: TaxActionState,
  formData: FormData,
): Promise<TaxActionState> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { status: "error", message: NOT_SIGNED_IN_MESSAGE };
  }

  const parsed = taxPaymentSchema.safeParse({
    financialYearId: readFormString(formData, "financialYearId"),
    paymentType: readFormString(formData, "paymentType"),
    amount: readFormString(formData, "amount"),
    paidOn: readFormString(formData, "paidOn"),
    challanReference: readFormString(formData, "challanReference"),
    relatedTransactionId: readFormString(formData, "relatedTransactionId"),
    notes: readFormString(formData, "notes"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("save_tax_payment", {
    p_financial_year_id: parsed.data.financialYearId,
    p_payment_type: parsed.data.paymentType,
    p_amount: parsed.data.amount.toNumber(),
    p_paid_on: parsed.data.paidOn,
    ...(parsed.data.challanReference
      ? { p_challan_reference: parsed.data.challanReference }
      : {}),
    ...(parsed.data.relatedTransactionId
      ? { p_related_transaction_id: parsed.data.relatedTransactionId }
      : {}),
    ...(parsed.data.notes ? { p_notes: parsed.data.notes } : {}),
  });

  if (error) {
    logTaxError("payment", error.code);
    return {
      status: "error",
      message:
        error.code === "23505"
          ? "That transaction is already linked to another tax payment."
          : GENERIC_FAILED_MESSAGE,
    };
  }

  revalidateFinancialYear(parsed.data.financialYearId);
  return { status: "success", message: "Tax payment recorded." };
}

export async function deleteTaxPaymentAction(
  _prevState: TaxActionState,
  formData: FormData,
): Promise<TaxActionState> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { status: "error", message: NOT_SIGNED_IN_MESSAGE };
  }

  const id = readFormString(formData, "id");
  const financialYearId = readFormString(formData, "financialYearId");
  if (!id) {
    return { status: "error", message: GENERIC_FAILED_MESSAGE };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("delete_tax_payment", { p_id: id });

  if (error) {
    logTaxError("payment-delete", error.code);
    return { status: "error", message: GENERIC_FAILED_MESSAGE };
  }

  if (financialYearId) {
    revalidateFinancialYear(financialYearId);
  }
  return { status: "success", message: "Tax payment removed." };
}

export async function saveTaxAssetClassificationAction(
  _prevState: TaxActionState,
  formData: FormData,
): Promise<TaxActionState> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { status: "error", message: NOT_SIGNED_IN_MESSAGE };
  }

  const parsed = taxAssetClassificationSchema.safeParse({
    investmentAssetId: readFormString(formData, "investmentAssetId"),
    assetClass: readFormString(formData, "assetClass"),
    unsupportedReason: readFormString(formData, "unsupportedReason"),
    notes: readFormString(formData, "notes"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("save_tax_asset_classification", {
    p_investment_asset_id: parsed.data.investmentAssetId,
    p_asset_class: parsed.data.assetClass,
    ...(parsed.data.unsupportedReason
      ? { p_unsupported_reason: parsed.data.unsupportedReason }
      : {}),
    ...(parsed.data.notes ? { p_notes: parsed.data.notes } : {}),
  });

  if (error) {
    logTaxError("asset-classification", error.code);
    return { status: "error", message: GENERIC_FAILED_MESSAGE };
  }

  revalidatePath("/app/tax");
  return { status: "success", message: "Asset classification saved." };
}

export async function saveTaxReconciliationItemAction(
  _prevState: TaxActionState,
  formData: FormData,
): Promise<TaxActionState> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { status: "error", message: NOT_SIGNED_IN_MESSAGE };
  }

  const itemId = readFormString(formData, "itemId") || undefined;
  const parsed = taxReconciliationItemSchema.safeParse({
    financialYearId: readFormString(formData, "financialYearId"),
    source: readFormString(formData, "source"),
    incomeCategory: readFormString(formData, "incomeCategory"),
    reportedAmount: readFormString(formData, "reportedAmount"),
    processedAmount: readFormString(formData, "processedAmount"),
    penraAmount: readFormString(formData, "penraAmount"),
    acceptedAmount: readFormString(formData, "acceptedAmount"),
    status: readFormString(formData, "status") || "unreviewed",
    explanation: readFormString(formData, "explanation"),
    evidenceSource: readFormString(formData, "evidenceSource"),
    evidenceDate: readFormString(formData, "evidenceDate"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("save_tax_reconciliation_item", {
    p_financial_year_id: parsed.data.financialYearId,
    p_source: parsed.data.source,
    p_income_category: parsed.data.incomeCategory,
    ...(parsed.data.reportedAmount !== undefined
      ? { p_reported_amount: parsed.data.reportedAmount.toNumber() }
      : {}),
    ...(parsed.data.processedAmount !== undefined
      ? { p_processed_amount: parsed.data.processedAmount.toNumber() }
      : {}),
    ...(parsed.data.penraAmount !== undefined
      ? { p_penra_amount: parsed.data.penraAmount.toNumber() }
      : {}),
    ...(parsed.data.acceptedAmount !== undefined
      ? { p_accepted_amount: parsed.data.acceptedAmount.toNumber() }
      : {}),
    p_status: parsed.data.status,
    ...(parsed.data.explanation
      ? { p_explanation: parsed.data.explanation }
      : {}),
    ...(parsed.data.evidenceSource
      ? { p_evidence_source: parsed.data.evidenceSource }
      : {}),
    ...(parsed.data.evidenceDate
      ? { p_evidence_date: parsed.data.evidenceDate }
      : {}),
    ...(itemId ? { p_item_id: itemId } : {}),
  });

  if (error) {
    logTaxError("reconciliation", error.code);
    return { status: "error", message: GENERIC_FAILED_MESSAGE };
  }

  revalidateFinancialYear(parsed.data.financialYearId);
  return { status: "success", message: "Reconciliation item saved." };
}

export async function deleteTaxReconciliationItemAction(
  _prevState: TaxActionState,
  formData: FormData,
): Promise<TaxActionState> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { status: "error", message: NOT_SIGNED_IN_MESSAGE };
  }

  const id = readFormString(formData, "id");
  const financialYearId = readFormString(formData, "financialYearId");
  if (!id) {
    return { status: "error", message: GENERIC_FAILED_MESSAGE };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("delete_tax_reconciliation_item", {
    p_id: id,
  });

  if (error) {
    logTaxError("reconciliation-delete", error.code);
    return { status: "error", message: GENERIC_FAILED_MESSAGE };
  }

  if (financialYearId) {
    revalidateFinancialYear(financialYearId);
  }
  return { status: "success", message: "Reconciliation item removed." };
}

/**
 * Generates (or regenerates) a draft snapshot from an already-computed
 * result — the caller (a Server Component/Action running
 * src/lib/tax/engine) supplies the finished JSON, this action only ever
 * persists it. When `supersedesSnapshotId` is given, the RPC atomically
 * marks that prior finalized snapshot superseded in the same transaction.
 */
export async function createTaxReportSnapshotAction(
  financialYearId: string,
  assessmentYearId: string,
  ruleSetVersion: string,
  completenessStatus: string,
  snapshotData: Json,
  warnings: string[],
  supersedesSnapshotId?: string,
): Promise<TaxActionState> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { status: "error", message: NOT_SIGNED_IN_MESSAGE };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("create_tax_report_snapshot", {
    p_financial_year_id: financialYearId,
    p_assessment_year_id: assessmentYearId,
    p_rule_set_version: ruleSetVersion,
    p_completeness_status: completenessStatus,
    p_snapshot_data: snapshotData,
    p_warnings: warnings,
    ...(supersedesSnapshotId
      ? { p_supersedes_snapshot_id: supersedesSnapshotId }
      : {}),
  });

  if (error) {
    logTaxError("snapshot-create", error.code);
    return { status: "error", message: GENERIC_FAILED_MESSAGE };
  }

  revalidateFinancialYear(financialYearId);
  return { status: "success", message: "Report generated." };
}

export async function finalizeTaxReportSnapshotAction(
  _prevState: TaxActionState,
  formData: FormData,
): Promise<TaxActionState> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { status: "error", message: NOT_SIGNED_IN_MESSAGE };
  }

  const snapshotId = readFormString(formData, "snapshotId");
  const financialYearId = readFormString(formData, "financialYearId");
  if (!snapshotId) {
    return { status: "error", message: GENERIC_FAILED_MESSAGE };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("finalize_tax_report_snapshot", {
    p_snapshot_id: snapshotId,
  });

  if (error) {
    logTaxError("snapshot-finalize", error.code);
    return {
      status: "error",
      message:
        error.code === "22023"
          ? "This report is already finalized."
          : GENERIC_FAILED_MESSAGE,
    };
  }

  if (financialYearId) {
    revalidateFinancialYear(financialYearId);
  }
  return { status: "success", message: "Report finalized." };
}

/**
 * Assembles every already-persisted tax input plus a live run of the
 * capital-gains and regime-comparison engines into one draft snapshot.
 * Never called automatically — the user explicitly generates a report,
 * exactly like every other snapshot action. If a finalized snapshot
 * already exists for this financial year, the new draft records it via
 * `supersedesSnapshotId` so finalizing the new one will correctly mark
 * the old one superseded (see create_tax_report_snapshot).
 */
export async function generateTaxReportSnapshotAction(
  _prevState: TaxActionState,
  formData: FormData,
): Promise<TaxActionState> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { status: "error", message: NOT_SIGNED_IN_MESSAGE };
  }

  const financialYearId = readFormString(formData, "financialYearId");
  if (!isValidFinancialYearId(financialYearId)) {
    return { status: "error", message: "Invalid financial year." };
  }

  const fy = parseFinancialYearId(financialYearId);
  const ruleSetLookup = getTaxRuleSet(financialYearId);
  const supabase = await createSupabaseServerClient();

  const [
    incomeAdjustments,
    deductions,
    withholdings,
    payments,
    reconciliationItems,
    priorFinalized,
  ] = await Promise.all([
    listTaxIncomeAdjustments(supabase, financialYearId),
    listTaxDeductions(supabase, financialYearId),
    listTaxWithholdings(supabase, financialYearId),
    listTaxPayments(supabase, financialYearId),
    listTaxReconciliationItems(supabase, financialYearId),
    getLatestFinalizedTaxReportSnapshot(supabase, financialYearId),
  ]);

  const warnings: string[] = [];
  let completenessStatus: "complete" | "partial" | "unavailable" = "complete";

  let capitalGains: Awaited<
    ReturnType<typeof getCapitalGainsReportForYear>
  > | null = null;
  let regimeComparison: RegimeComparisonAvailability | null = null;

  if (ruleSetLookup.available) {
    capitalGains = await getCapitalGainsReportForYear(
      supabase,
      ruleSetLookup.ruleSet,
      fy,
    );
    if (capitalGains.report.status === "partial") {
      completenessStatus = "partial";
      warnings.push(
        "Some capital-gains disposals could not be fully matched or classified — see the capital gains page.",
      );
    }
    if (capitalGains.unclassifiedHoldingCount > 0) {
      completenessStatus = "partial";
      warnings.push(
        `${capitalGains.unclassifiedHoldingCount} investment holding(s) are not yet classified for tax purposes.`,
      );
    }
    if (capitalGains.mixedCurrencyHoldingCount > 0) {
      completenessStatus = "partial";
      warnings.push(
        `${capitalGains.mixedCurrencyHoldingCount} investment holding(s) have activities recorded in more than one currency and are excluded from capital-gains matching.`,
      );
    }

    regimeComparison = await getRegimeComparisonForYear(
      supabase,
      ruleSetLookup.ruleSet,
      fy,
    );
    if (!regimeComparison.available) {
      completenessStatus = "partial";
      warnings.push(
        regimeComparison.reasonCode === "no_profile"
          ? "No tax profile set — regime comparison unavailable."
          : "Tax profile is outside supported scope — regime comparison unavailable.",
      );
    } else if (
      regimeComparison.result.old.status !== "available" ||
      regimeComparison.result.new.status !== "available"
    ) {
      completenessStatus = "partial";
      warnings.push(
        "Regime comparison is partial — surcharge above ₹50,00,000 is not yet supported.",
      );
    }
  } else {
    completenessStatus = "unavailable";
    warnings.push(
      `No versioned tax rule set is published for ${fy.label} yet — slab tax, capital gains, and regime comparison are all unavailable.`,
    );
  }

  const unconfirmedIncome = incomeAdjustments.filter(
    (i) => i.status === "draft",
  ).length;
  if (unconfirmedIncome > 0) {
    warnings.push(
      `${unconfirmedIncome} income item(s) are still draft, not confirmed.`,
    );
  }
  const unresolvedReconciliation = reconciliationItems.filter(
    (r) =>
      r.status === "difference" ||
      r.status === "missing_in_penra" ||
      r.status === "missing_in_statement",
  ).length;
  if (unresolvedReconciliation > 0) {
    warnings.push(
      `${unresolvedReconciliation} AIS/26AS reconciliation item(s) are unresolved.`,
    );
  }

  const snapshotData = serializeForSnapshot({
    financialYearId,
    assessmentYearId: fy.assessmentYearId,
    generatedAt: new Date().toISOString(),
    incomeAdjustments,
    deductions,
    withholdings,
    payments,
    reconciliationItems,
    capitalGains: capitalGains?.report ?? null,
    regimeComparison: regimeComparison?.available
      ? regimeComparison.result
      : null,
  });

  const { error } = await supabase.rpc("create_tax_report_snapshot", {
    p_financial_year_id: financialYearId,
    p_assessment_year_id: fy.assessmentYearId,
    p_rule_set_version: ruleSetLookup.available
      ? ruleSetLookup.ruleSet.ruleSetVersion
      : "unavailable",
    p_completeness_status: completenessStatus,
    p_snapshot_data: snapshotData,
    p_warnings: warnings,
    ...(priorFinalized ? { p_supersedes_snapshot_id: priorFinalized.id } : {}),
  });

  if (error) {
    logTaxError("snapshot-generate", error.code);
    return { status: "error", message: GENERIC_FAILED_MESSAGE };
  }

  revalidateFinancialYear(financialYearId);
  return { status: "success", message: "Report generated." };
}
