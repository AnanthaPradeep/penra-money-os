import type { Tables } from "@/types/database.types";

/** A row of `public.tax_profiles` (see supabase/migrations/20260827175529_phase13_tax_workspace.sql). */
export type TaxProfileRow = Tables<"tax_profiles">;

/** A row of `public.tax_income_adjustments`. */
export type TaxIncomeAdjustmentRow = Tables<"tax_income_adjustments">;

/** A row of `public.tax_deductions`. */
export type TaxDeductionRow = Tables<"tax_deductions">;

/** A row of `public.tax_withholdings`. */
export type TaxWithholdingRow = Tables<"tax_withholdings">;

/** A row of `public.tax_payments`. */
export type TaxPaymentRow = Tables<"tax_payments">;

/** A row of `public.tax_asset_classifications`. */
export type TaxAssetClassificationRow = Tables<"tax_asset_classifications">;

/** A row of `public.tax_reconciliation_items`. */
export type TaxReconciliationItemRow = Tables<"tax_reconciliation_items">;

/** A row of `public.tax_report_snapshots`. */
export type TaxReportSnapshotRow = Tables<"tax_report_snapshots">;
