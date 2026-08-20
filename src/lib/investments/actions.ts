"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { getAuthenticatedUser } from "@/lib/auth/session";
import type { InvestmentActionState } from "@/lib/investments/action-state";
import {
  fixedDepositSchema,
  investmentActivitySchema,
  investmentAssetSchema,
  investmentHoldingSchema,
  manualValuationSchema,
  matureFixedDepositSchema,
  ppfAccountSchema,
  recurringDepositSchema,
  setFixedIncomeStatusSchema,
  setInvestmentAssetStatusSchema,
  setInvestmentHoldingStatusSchema,
  updateInvestmentAssetSchema,
} from "@/lib/investments/schema";
import { INVESTMENT_ASSET_KINDS } from "@/lib/investments/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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
function logInvestmentError(context: string, code: string | undefined): void {
  if (process.env.NODE_ENV === "production") {
    return;
  }
  console.error(`[investments:${context}]`, { code: code ?? "unknown" });
}

const NOT_SIGNED_IN_MESSAGE =
  "You need to sign in again to manage investments.";
const CREATE_FAILED_MESSAGE = "We couldn't create that. Please try again.";
const UPDATE_FAILED_MESSAGE = "We couldn't save that change. Please try again.";
const ACTIVITY_FAILED_MESSAGE =
  "We couldn't record that activity. Please check the details and try again.";
const VALUATION_FAILED_MESSAGE =
  "We couldn't save that valuation. Please try again.";
const REVERSE_FAILED_MESSAGE =
  "We couldn't reverse that activity. Please try again.";
const MATURE_FAILED_MESSAGE =
  "We couldn't complete the maturity. Please try again.";

/** Creates a stock/mutual-fund/other-investment asset and its first holding together — see public.create_investment_asset / create_investment_holding. Not a single atomic RPC (unlike PPF/FD/RD, which have one) — a failure between the two steps leaves only an unattached descriptive asset row, never a partial financial posting. */
export async function createInvestmentHoldingAction(
  _prevState: InvestmentActionState,
  formData: FormData,
): Promise<InvestmentActionState> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { status: "error", message: NOT_SIGNED_IN_MESSAGE };
  }

  const assetKindRaw = readFormString(formData, "assetKind");
  const parsedAsset = investmentAssetSchema
    .extend({ assetKind: z.enum(INVESTMENT_ASSET_KINDS) })
    .safeParse({
      assetKind: assetKindRaw,
      displayName: readFormString(formData, "displayName"),
      symbol: readFormString(formData, "symbol"),
      exchange: readFormString(formData, "exchange"),
      isin: readFormString(formData, "isin"),
      schemeCode: readFormString(formData, "schemeCode"),
      notes: readFormString(formData, "notes"),
    });
  const parsedHolding = investmentHoldingSchema
    .omit({ investmentAssetId: true })
    .safeParse({
      investmentAccountId: readFormString(formData, "investmentAccountId"),
      openedDate: readFormString(formData, "openedDate"),
    });

  if (!parsedAsset.success || !parsedHolding.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: {
        ...(parsedAsset.success ? {} : fieldErrorsFromZod(parsedAsset.error)),
        ...(parsedHolding.success
          ? {}
          : fieldErrorsFromZod(parsedHolding.error)),
      },
    };
  }

  const supabase = await createSupabaseServerClient();
  const asset = parsedAsset.data;

  const { data: createdAsset, error: assetError } = await supabase.rpc(
    "create_investment_asset",
    {
      p_asset_kind: asset.assetKind,
      p_display_name: asset.displayName,
      ...(asset.symbol ? { p_symbol: asset.symbol } : {}),
      ...(asset.exchange ? { p_exchange: asset.exchange } : {}),
      ...(asset.isin ? { p_isin: asset.isin } : {}),
      ...(asset.schemeCode ? { p_scheme_code: asset.schemeCode } : {}),
      ...(asset.notes ? { p_notes: asset.notes } : {}),
    },
  );

  if (assetError || !createdAsset) {
    logInvestmentError("create-asset", assetError?.code);
    if (assetError?.code === "23505") {
      return {
        status: "error",
        message: "You already have an investment with this name (or ISIN).",
        fieldErrors: { displayName: "Already exists." },
      };
    }
    return { status: "error", message: CREATE_FAILED_MESSAGE };
  }

  const holding = parsedHolding.data;
  const { data: createdHolding, error: holdingError } = await supabase.rpc(
    "create_investment_holding",
    {
      p_investment_asset_id: createdAsset.id,
      ...(holding.investmentAccountId
        ? { p_investment_account_id: holding.investmentAccountId }
        : {}),
      p_opened_date: holding.openedDate,
    },
  );

  if (holdingError || !createdHolding) {
    logInvestmentError("create-holding", holdingError?.code);
    return { status: "error", message: CREATE_FAILED_MESSAGE };
  }

  redirect(`/app/investments/${createdHolding.id}?created=1`);
}

export async function updateInvestmentAssetAction(
  _prevState: InvestmentActionState,
  formData: FormData,
): Promise<InvestmentActionState> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { status: "error", message: NOT_SIGNED_IN_MESSAGE };
  }

  const assetId = readFormString(formData, "assetId");
  if (!assetId) {
    return { status: "error", message: UPDATE_FAILED_MESSAGE };
  }

  const parsed = updateInvestmentAssetSchema.safeParse({
    displayName: readFormString(formData, "displayName"),
    symbol: readFormString(formData, "symbol"),
    exchange: readFormString(formData, "exchange"),
    isin: readFormString(formData, "isin"),
    schemeCode: readFormString(formData, "schemeCode"),
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
  const data = parsed.data;

  const { error } = await supabase.rpc("update_investment_asset", {
    p_id: assetId,
    p_display_name: data.displayName,
    ...(data.symbol ? { p_symbol: data.symbol } : {}),
    ...(data.exchange ? { p_exchange: data.exchange } : {}),
    ...(data.isin ? { p_isin: data.isin } : {}),
    ...(data.schemeCode ? { p_scheme_code: data.schemeCode } : {}),
    ...(data.notes ? { p_notes: data.notes } : {}),
  });

  if (error) {
    logInvestmentError("update-asset", error.code);
    return { status: "error", message: UPDATE_FAILED_MESSAGE };
  }

  return { status: "success", message: "Investment details updated." };
}

export async function setInvestmentAssetStatusAction(
  _prevState: InvestmentActionState,
  formData: FormData,
): Promise<InvestmentActionState> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { status: "error", message: NOT_SIGNED_IN_MESSAGE };
  }

  const assetId = readFormString(formData, "assetId");
  const parsed = setInvestmentAssetStatusSchema.safeParse({
    status: readFormString(formData, "status"),
  });
  if (!assetId || !parsed.success) {
    return { status: "error", message: UPDATE_FAILED_MESSAGE };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("set_investment_asset_status", {
    p_id: assetId,
    p_status: parsed.data.status,
  });

  if (error) {
    logInvestmentError("set-asset-status", error.code);
    return { status: "error", message: UPDATE_FAILED_MESSAGE };
  }

  return { status: "success", message: "Status updated." };
}

export async function setInvestmentHoldingStatusAction(
  _prevState: InvestmentActionState,
  formData: FormData,
): Promise<InvestmentActionState> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { status: "error", message: NOT_SIGNED_IN_MESSAGE };
  }

  const holdingId = readFormString(formData, "holdingId");
  const parsed = setInvestmentHoldingStatusSchema.safeParse({
    status: readFormString(formData, "status"),
  });
  if (!holdingId || !parsed.success) {
    return { status: "error", message: UPDATE_FAILED_MESSAGE };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("set_investment_holding_status", {
    p_id: holdingId,
    p_status: parsed.data.status,
  });

  if (error) {
    logInvestmentError("set-holding-status", error.code);
    return { status: "error", message: UPDATE_FAILED_MESSAGE };
  }

  return { status: "success", message: "Status updated." };
}

/** Dispatches to the correct record_investment_* RPC based on activityKind — one Server Action for the whole discriminated-union composer, mirroring how NewTransactionForm's per-type forms each already do their own single-purpose dispatch. */
export async function recordInvestmentActivityAction(
  _prevState: InvestmentActionState,
  formData: FormData,
): Promise<InvestmentActionState> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { status: "error", message: NOT_SIGNED_IN_MESSAGE };
  }

  const holdingId = readFormString(formData, "holdingId");
  if (!holdingId) {
    return { status: "error", message: ACTIVITY_FAILED_MESSAGE };
  }

  const activityKind = readFormString(formData, "activityKind");
  const raw: Record<string, string> = {
    activityKind,
    fundingAccountId: readFormString(formData, "fundingAccountId"),
    receivingAccountId: readFormString(formData, "receivingAccountId"),
    tradeDate: readFormString(formData, "tradeDate"),
    settlementDate: readFormString(formData, "settlementDate"),
    quantity: readFormString(formData, "quantity"),
    unitPrice: readFormString(formData, "unitPrice"),
    feeAmount: readFormString(formData, "feeAmount"),
    taxAmount: readFormString(formData, "taxAmount"),
    grossAmount: readFormString(formData, "grossAmount"),
    categoryId: readFormString(formData, "categoryId"),
    payeeId: readFormString(formData, "payeeId"),
    notes: readFormString(formData, "notes"),
    idempotencyKey: readFormString(formData, "idempotencyKey"),
    quantityDelta: readFormString(formData, "quantityDelta"),
    costBasisDelta: readFormString(formData, "costBasisDelta"),
  };

  const parsed = investmentActivitySchema.safeParse(raw);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  const supabase = await createSupabaseServerClient();
  const data = parsed.data;
  let rpcError: { code?: string } | null = null;

  if (data.activityKind === "buy") {
    const { error } = await supabase.rpc("record_investment_purchase", {
      p_holding_id: holdingId,
      p_funding_account_id: data.fundingAccountId,
      p_trade_date: data.tradeDate,
      p_quantity: data.quantity.toNumber(),
      p_unit_price: data.unitPrice.toNumber(),
      p_idempotency_key: data.idempotencyKey,
      ...(data.feeAmount ? { p_fee_amount: data.feeAmount.toNumber() } : {}),
      ...(data.settlementDate
        ? { p_settlement_date: data.settlementDate }
        : {}),
      ...(data.notes ? { p_notes: data.notes } : {}),
    });
    rpcError = error;
  } else if (data.activityKind === "sell") {
    const { error } = await supabase.rpc("record_investment_sale", {
      p_holding_id: holdingId,
      p_receiving_account_id: data.receivingAccountId,
      p_trade_date: data.tradeDate,
      p_quantity: data.quantity.toNumber(),
      p_unit_price: data.unitPrice.toNumber(),
      p_idempotency_key: data.idempotencyKey,
      ...(data.feeAmount ? { p_fee_amount: data.feeAmount.toNumber() } : {}),
      ...(data.taxAmount ? { p_tax_amount: data.taxAmount.toNumber() } : {}),
      ...(data.settlementDate
        ? { p_settlement_date: data.settlementDate }
        : {}),
      ...(data.notes ? { p_notes: data.notes } : {}),
    });
    rpcError = error;
  } else if (data.activityKind === "contribution") {
    const { error } = await supabase.rpc("record_investment_contribution", {
      p_holding_id: holdingId,
      p_funding_account_id: data.fundingAccountId,
      p_trade_date: data.tradeDate,
      p_gross_amount: data.grossAmount.toNumber(),
      p_idempotency_key: data.idempotencyKey,
      ...(data.notes ? { p_notes: data.notes } : {}),
    });
    rpcError = error;
  } else if (data.activityKind === "withdrawal") {
    const { error } = await supabase.rpc("record_investment_withdrawal", {
      p_holding_id: holdingId,
      p_receiving_account_id: data.receivingAccountId,
      p_trade_date: data.tradeDate,
      p_gross_amount: data.grossAmount.toNumber(),
      p_idempotency_key: data.idempotencyKey,
      ...(data.notes ? { p_notes: data.notes } : {}),
    });
    rpcError = error;
  } else if (
    data.activityKind === "dividend" ||
    data.activityKind === "interest"
  ) {
    const { error } = await supabase.rpc("record_investment_income", {
      p_holding_id: holdingId,
      p_activity_kind: data.activityKind,
      p_receiving_account_id: data.receivingAccountId,
      p_trade_date: data.tradeDate,
      p_gross_amount: data.grossAmount.toNumber(),
      p_category_id: data.categoryId,
      p_idempotency_key: data.idempotencyKey,
      ...(data.payeeId ? { p_payee_id: data.payeeId } : {}),
      ...(data.notes ? { p_notes: data.notes } : {}),
    });
    rpcError = error;
  } else if (data.activityKind === "fee") {
    const { error } = await supabase.rpc("record_investment_fee", {
      p_holding_id: holdingId,
      p_funding_account_id: data.fundingAccountId,
      p_trade_date: data.tradeDate,
      p_gross_amount: data.grossAmount.toNumber(),
      p_idempotency_key: data.idempotencyKey,
      ...(data.categoryId ? { p_category_id: data.categoryId } : {}),
      ...(data.notes ? { p_notes: data.notes } : {}),
    });
    rpcError = error;
  } else {
    const { error } = await supabase.rpc("record_investment_adjustment", {
      p_holding_id: holdingId,
      p_trade_date: data.tradeDate,
      p_notes: data.notes,
      ...(data.quantityDelta !== undefined
        ? { p_quantity_delta: data.quantityDelta.toNumber() }
        : {}),
      ...(data.costBasisDelta !== undefined
        ? { p_cost_basis_delta: data.costBasisDelta.toNumber() }
        : {}),
    });
    rpcError = error;
  }

  if (rpcError) {
    logInvestmentError(`record-activity:${data.activityKind}`, rpcError.code);
    if (rpcError.code === "23514") {
      return {
        status: "error",
        message:
          data.activityKind === "sell"
            ? "You can't sell more units than you currently hold."
            : "That would exceed the amount currently available.",
      };
    }
    return { status: "error", message: ACTIVITY_FAILED_MESSAGE };
  }

  return { status: "success", message: "Activity recorded.", holdingId };
}

export async function reverseInvestmentActivityAction(
  _prevState: InvestmentActionState,
  formData: FormData,
): Promise<InvestmentActionState> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { status: "error", message: NOT_SIGNED_IN_MESSAGE };
  }

  const activityId = readFormString(formData, "activityId");
  if (!activityId) {
    return { status: "error", message: REVERSE_FAILED_MESSAGE };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("reverse_investment_activity", {
    p_activity_id: activityId,
  });

  if (error) {
    logInvestmentError("reverse-activity", error.code);
    return { status: "error", message: REVERSE_FAILED_MESSAGE };
  }

  return { status: "success", message: "Activity reversed." };
}

export async function addInvestmentValuationAction(
  _prevState: InvestmentActionState,
  formData: FormData,
): Promise<InvestmentActionState> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { status: "error", message: NOT_SIGNED_IN_MESSAGE };
  }

  const holdingId = readFormString(formData, "holdingId");
  if (!holdingId) {
    return { status: "error", message: VALUATION_FAILED_MESSAGE };
  }

  const parsed = manualValuationSchema.safeParse({
    valuedAt: readFormString(formData, "valuedAt"),
    totalValue: readFormString(formData, "totalValue"),
    unitValue: readFormString(formData, "unitValue"),
    note: readFormString(formData, "note"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  const supabase = await createSupabaseServerClient();
  const data = parsed.data;

  const { error } = await supabase.rpc("add_investment_valuation", {
    p_holding_id: holdingId,
    p_valued_at: `${data.valuedAt}T00:00:00+05:30`,
    p_total_value: data.totalValue.toNumber(),
    ...(data.unitValue !== undefined
      ? { p_unit_value: data.unitValue.toNumber() }
      : {}),
    ...(data.note ? { p_note: data.note } : {}),
  });

  if (error) {
    logInvestmentError("add-valuation", error.code);
    return { status: "error", message: VALUATION_FAILED_MESSAGE };
  }

  return { status: "success", message: "Manual valuation saved.", holdingId };
}

export async function createPpfAccountAction(
  _prevState: InvestmentActionState,
  formData: FormData,
): Promise<InvestmentActionState> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { status: "error", message: NOT_SIGNED_IN_MESSAGE };
  }

  const parsed = ppfAccountSchema.safeParse({
    displayName: readFormString(formData, "displayName"),
    investmentAccountId: readFormString(formData, "investmentAccountId"),
    provider: readFormString(formData, "provider"),
    startDate: readFormString(formData, "startDate"),
    maturityDate: readFormString(formData, "maturityDate"),
    interestRate: readFormString(formData, "interestRate"),
    notes: readFormString(formData, "notes"),
    openingContributionAmount: readFormString(
      formData,
      "openingContributionAmount",
    ),
    openingContributionFundingAccountId: readFormString(
      formData,
      "openingContributionFundingAccountId",
    ),
    openingContributionIdempotencyKey: readFormString(
      formData,
      "openingContributionIdempotencyKey",
    ),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  const supabase = await createSupabaseServerClient();
  const data = parsed.data;

  const { data: holding, error } = await supabase.rpc("create_ppf_account", {
    p_display_name: data.displayName,
    p_investment_account_id: data.investmentAccountId,
    p_start_date: data.startDate,
    ...(data.provider ? { p_provider: data.provider } : {}),
    ...(data.maturityDate ? { p_maturity_date: data.maturityDate } : {}),
    ...(data.interestRate
      ? { p_interest_rate: Number(data.interestRate) }
      : {}),
    ...(data.notes ? { p_notes: data.notes } : {}),
    ...(data.openingContributionAmount
      ? {
          p_opening_contribution_amount:
            data.openingContributionAmount.toNumber(),
        }
      : {}),
    ...(data.openingContributionFundingAccountId
      ? {
          p_opening_contribution_funding_account_id:
            data.openingContributionFundingAccountId,
        }
      : {}),
    ...(data.openingContributionIdempotencyKey
      ? {
          p_opening_contribution_idempotency_key:
            data.openingContributionIdempotencyKey,
        }
      : {}),
  });

  if (error || !holding) {
    logInvestmentError("create-ppf", error?.code);
    return { status: "error", message: CREATE_FAILED_MESSAGE };
  }

  redirect(`/app/investments/${holding.id}?created=1`);
}

export async function createFixedDepositAction(
  _prevState: InvestmentActionState,
  formData: FormData,
): Promise<InvestmentActionState> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { status: "error", message: NOT_SIGNED_IN_MESSAGE };
  }

  const parsed = fixedDepositSchema.safeParse({
    displayName: readFormString(formData, "displayName"),
    investmentAccountId: readFormString(formData, "investmentAccountId"),
    fundingAccountId: readFormString(formData, "fundingAccountId"),
    principalAmount: readFormString(formData, "principalAmount"),
    startDate: readFormString(formData, "startDate"),
    maturityDate: readFormString(formData, "maturityDate"),
    provider: readFormString(formData, "provider"),
    interestRate: readFormString(formData, "interestRate"),
    compoundingFrequency:
      readFormString(formData, "compoundingFrequency") || undefined,
    interestPayoutMode:
      readFormString(formData, "interestPayoutMode") || undefined,
    expectedMaturityAmount: readFormString(formData, "expectedMaturityAmount"),
    notes: readFormString(formData, "notes"),
    idempotencyKey: readFormString(formData, "idempotencyKey"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  const supabase = await createSupabaseServerClient();
  const data = parsed.data;

  const { data: holding, error } = await supabase.rpc("create_fixed_deposit", {
    p_display_name: data.displayName,
    p_investment_account_id: data.investmentAccountId,
    p_funding_account_id: data.fundingAccountId,
    p_principal_amount: data.principalAmount.toNumber(),
    p_start_date: data.startDate,
    p_maturity_date: data.maturityDate,
    p_idempotency_key: data.idempotencyKey,
    ...(data.provider ? { p_provider: data.provider } : {}),
    ...(data.interestRate
      ? { p_interest_rate: Number(data.interestRate) }
      : {}),
    ...(data.compoundingFrequency
      ? { p_compounding_frequency: data.compoundingFrequency }
      : {}),
    ...(data.interestPayoutMode
      ? { p_interest_payout_mode: data.interestPayoutMode }
      : {}),
    ...(data.expectedMaturityAmount
      ? { p_expected_maturity_amount: data.expectedMaturityAmount.toNumber() }
      : {}),
    ...(data.notes ? { p_notes: data.notes } : {}),
  });

  if (error || !holding) {
    logInvestmentError("create-fd", error?.code);
    return { status: "error", message: CREATE_FAILED_MESSAGE };
  }

  redirect(`/app/investments/${holding.id}?created=1`);
}

export async function matureFixedDepositAction(
  _prevState: InvestmentActionState,
  formData: FormData,
): Promise<InvestmentActionState> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { status: "error", message: NOT_SIGNED_IN_MESSAGE };
  }

  const holdingId = readFormString(formData, "holdingId");
  if (!holdingId) {
    return { status: "error", message: MATURE_FAILED_MESSAGE };
  }

  const parsed = matureFixedDepositSchema.safeParse({
    receivingAccountId: readFormString(formData, "receivingAccountId"),
    actualMaturityAmount: readFormString(formData, "actualMaturityAmount"),
    maturityDate: readFormString(formData, "maturityDate"),
    notes: readFormString(formData, "notes"),
    idempotencyKey: readFormString(formData, "idempotencyKey"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  const supabase = await createSupabaseServerClient();
  const data = parsed.data;

  const { error } = await supabase.rpc("mature_fixed_deposit", {
    p_holding_id: holdingId,
    p_receiving_account_id: data.receivingAccountId,
    p_actual_maturity_amount: data.actualMaturityAmount.toNumber(),
    p_maturity_date: data.maturityDate,
    p_idempotency_key: data.idempotencyKey,
    ...(data.notes ? { p_notes: data.notes } : {}),
  });

  if (error) {
    logInvestmentError("mature-fd", error.code);
    if (error.code === "25000") {
      return { status: "error", message: "This has already matured." };
    }
    return { status: "error", message: MATURE_FAILED_MESSAGE };
  }

  return { status: "success", message: "Marked as matured.", holdingId };
}

export async function createRecurringDepositAction(
  _prevState: InvestmentActionState,
  formData: FormData,
): Promise<InvestmentActionState> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { status: "error", message: NOT_SIGNED_IN_MESSAGE };
  }

  const parsed = recurringDepositSchema.safeParse({
    displayName: readFormString(formData, "displayName"),
    investmentAccountId: readFormString(formData, "investmentAccountId"),
    fundingAccountId: readFormString(formData, "fundingAccountId"),
    installmentAmount: readFormString(formData, "installmentAmount"),
    frequency: readFormString(formData, "frequency"),
    intervalCount: readFormString(formData, "intervalCount") || "1",
    startDate: readFormString(formData, "startDate"),
    maturityDate: readFormString(formData, "maturityDate"),
    provider: readFormString(formData, "provider"),
    interestRate: readFormString(formData, "interestRate"),
    plannedInstallments:
      readFormString(formData, "plannedInstallments") || undefined,
    expectedMaturityAmount: readFormString(formData, "expectedMaturityAmount"),
    processingMode: readFormString(formData, "processingMode"),
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
  const data = parsed.data;

  const { data: holding, error } = await supabase.rpc(
    "create_recurring_deposit",
    {
      p_display_name: data.displayName,
      p_investment_account_id: data.investmentAccountId,
      p_funding_account_id: data.fundingAccountId,
      p_installment_amount: data.installmentAmount.toNumber(),
      p_frequency: data.frequency,
      p_start_date: data.startDate,
      p_maturity_date: data.maturityDate,
      p_processing_mode: data.processingMode,
      p_interval_count: data.intervalCount,
      ...(data.provider ? { p_provider: data.provider } : {}),
      ...(data.interestRate
        ? { p_interest_rate: Number(data.interestRate) }
        : {}),
      ...(data.plannedInstallments
        ? { p_planned_installments: data.plannedInstallments }
        : {}),
      ...(data.expectedMaturityAmount
        ? { p_expected_maturity_amount: data.expectedMaturityAmount.toNumber() }
        : {}),
      ...(data.notes ? { p_notes: data.notes } : {}),
    },
  );

  if (error || !holding) {
    logInvestmentError("create-rd", error?.code);
    return { status: "error", message: CREATE_FAILED_MESSAGE };
  }

  redirect(`/app/investments/${holding.id}?created=1`);
}

export async function setFixedIncomeStatusAction(
  _prevState: InvestmentActionState,
  formData: FormData,
): Promise<InvestmentActionState> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { status: "error", message: NOT_SIGNED_IN_MESSAGE };
  }

  const holdingId = readFormString(formData, "holdingId");
  const parsed = setFixedIncomeStatusSchema.safeParse({
    status: readFormString(formData, "status"),
  });
  if (!holdingId || !parsed.success) {
    return { status: "error", message: UPDATE_FAILED_MESSAGE };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("set_fixed_income_status", {
    p_holding_id: holdingId,
    p_status: parsed.data.status,
  });

  if (error) {
    logInvestmentError("set-fixed-income-status", error.code);
    return { status: "error", message: UPDATE_FAILED_MESSAGE };
  }

  return { status: "success", message: "Status updated." };
}
