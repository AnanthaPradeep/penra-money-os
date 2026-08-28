import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  mapTaxAssetClassificationRow,
  mapTaxDeductionRow,
  mapTaxIncomeAdjustmentRow,
  mapTaxPaymentRow,
  mapTaxProfileRow,
  mapTaxReconciliationItemRow,
  mapTaxReportSnapshotRow,
  mapTaxWithholdingRow,
  type TaxAssetClassification,
  type TaxDeduction,
  type TaxIncomeAdjustment,
  type TaxPayment,
  type TaxProfile,
  type TaxReconciliationItem,
  type TaxReportSnapshot,
  type TaxWithholding,
} from "@/lib/tax/mapping";
import type { Database } from "@/types/database.types";

/** Reads the caller's own tax profile, if one has been saved yet. */
export async function getTaxProfile(
  supabase: SupabaseClient<Database>,
): Promise<TaxProfile | null> {
  const { data, error } = await supabase
    .from("tax_profiles")
    .select("*")
    .maybeSingle();
  if (error || !data) {
    return null;
  }
  return mapTaxProfileRow(data);
}

export async function listTaxIncomeAdjustments(
  supabase: SupabaseClient<Database>,
  financialYearId: string,
): Promise<TaxIncomeAdjustment[]> {
  const { data, error } = await supabase
    .from("tax_income_adjustments")
    .select("*")
    .eq("financial_year_id", financialYearId)
    .order("category", { ascending: true });
  if (error || !data) {
    return [];
  }
  return data.map(mapTaxIncomeAdjustmentRow);
}

export async function listTaxDeductions(
  supabase: SupabaseClient<Database>,
  financialYearId: string,
): Promise<TaxDeduction[]> {
  const { data, error } = await supabase
    .from("tax_deductions")
    .select("*")
    .eq("financial_year_id", financialYearId)
    .order("section", { ascending: true });
  if (error || !data) {
    return [];
  }
  return data.map(mapTaxDeductionRow);
}

export async function listTaxWithholdings(
  supabase: SupabaseClient<Database>,
  financialYearId: string,
): Promise<TaxWithholding[]> {
  const { data, error } = await supabase
    .from("tax_withholdings")
    .select("*")
    .eq("financial_year_id", financialYearId)
    .order("withheld_on", { ascending: false });
  if (error || !data) {
    return [];
  }
  return data.map(mapTaxWithholdingRow);
}

export async function listTaxPayments(
  supabase: SupabaseClient<Database>,
  financialYearId: string,
): Promise<TaxPayment[]> {
  const { data, error } = await supabase
    .from("tax_payments")
    .select("*")
    .eq("financial_year_id", financialYearId)
    .order("paid_on", { ascending: false });
  if (error || !data) {
    return [];
  }
  return data.map(mapTaxPaymentRow);
}

export async function listTaxAssetClassifications(
  supabase: SupabaseClient<Database>,
): Promise<TaxAssetClassification[]> {
  const { data, error } = await supabase
    .from("tax_asset_classifications")
    .select("*");
  if (error || !data) {
    return [];
  }
  return data.map(mapTaxAssetClassificationRow);
}

export async function listTaxReconciliationItems(
  supabase: SupabaseClient<Database>,
  financialYearId: string,
): Promise<TaxReconciliationItem[]> {
  const { data, error } = await supabase
    .from("tax_reconciliation_items")
    .select("*")
    .eq("financial_year_id", financialYearId)
    .order("source", { ascending: true });
  if (error || !data) {
    return [];
  }
  return data.map(mapTaxReconciliationItemRow);
}

/** Every snapshot for one financial year, newest first — includes superseded/finalized history, not just the latest. */
export async function listTaxReportSnapshots(
  supabase: SupabaseClient<Database>,
  financialYearId: string,
): Promise<TaxReportSnapshot[]> {
  const { data, error } = await supabase
    .from("tax_report_snapshots")
    .select("*")
    .eq("financial_year_id", financialYearId)
    .order("created_at", { ascending: false });
  if (error || !data) {
    return [];
  }
  return data.map(mapTaxReportSnapshotRow);
}

/** The most recent finalized snapshot for one financial year, if any. */
export async function getLatestFinalizedTaxReportSnapshot(
  supabase: SupabaseClient<Database>,
  financialYearId: string,
): Promise<TaxReportSnapshot | null> {
  const { data, error } = await supabase
    .from("tax_report_snapshots")
    .select("*")
    .eq("financial_year_id", financialYearId)
    .eq("status", "finalized")
    .order("finalized_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) {
    return null;
  }
  return mapTaxReportSnapshotRow(data);
}

/** The most recent draft/needs_review/ready snapshot for one financial year, if any. */
export async function getLatestDraftTaxReportSnapshot(
  supabase: SupabaseClient<Database>,
  financialYearId: string,
): Promise<TaxReportSnapshot | null> {
  const { data, error } = await supabase
    .from("tax_report_snapshots")
    .select("*")
    .eq("financial_year_id", financialYearId)
    .in("status", ["draft", "needs_review", "ready"])
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) {
    return null;
  }
  return mapTaxReportSnapshotRow(data);
}
