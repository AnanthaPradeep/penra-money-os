"use server";

import type { z } from "zod";

import { getAuthenticatedUser } from "@/lib/auth/session";
import type { IpoActionState } from "@/lib/ipo/action-state";
import {
  addIpoDocumentSchema,
  addIpoFinancialMetricSchema,
  addIpoSchema,
  ipoResearchNoteSchema,
  updateIpoFieldsSchema,
  updateIpoWatchlistItemSchema,
  watchIpoSchema,
} from "@/lib/ipo/schema";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function readFormString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

/** Parses a hidden JSON-encoded array field (populated client-side from React state — see IpoResearchNoteForm's checklist editors). Malformed/missing input parses as an empty array rather than throwing, since zod validates the actual shape immediately after. */
function readFormJsonArray(formData: FormData, key: string): unknown[] {
  const raw = readFormString(formData, key);
  if (!raw) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
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
function logIpoError(context: string, code: string | undefined): void {
  if (process.env.NODE_ENV === "production") {
    return;
  }
  console.error(`[ipo:${context}]`, { code: code ?? "unknown" });
}

const NOT_SIGNED_IN_MESSAGE = "You need to sign in again to manage IPOs.";
const SAVE_FAILED_MESSAGE = "We couldn't save that. Please try again.";

export async function addIpoAction(
  _prevState: IpoActionState,
  formData: FormData,
): Promise<IpoActionState> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { status: "error", message: NOT_SIGNED_IN_MESSAGE };
  }

  const parsed = addIpoSchema.safeParse({
    issuerName: readFormString(formData, "issuerName"),
    board: readFormString(formData, "board"),
    sourceOrganization: readFormString(formData, "sourceOrganization"),
    sourceUrl: readFormString(formData, "sourceUrl"),
    cin: readFormString(formData, "cin"),
    isin: readFormString(formData, "isin"),
    exchange: readFormString(formData, "exchange"),
    industry: readFormString(formData, "industry"),
    issueType: readFormString(formData, "issueType") || undefined,
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
  const { data: created, error } = await supabase.rpc(
    "add_ipo_from_official_source",
    {
      p_issuer_name: data.issuerName,
      p_board: data.board,
      p_source_organization: data.sourceOrganization,
      p_source_url: data.sourceUrl,
      ...(data.cin ? { p_cin: data.cin } : {}),
      ...(data.isin ? { p_isin: data.isin } : {}),
      ...(data.exchange ? { p_exchange: data.exchange } : {}),
      ...(data.industry ? { p_industry: data.industry } : {}),
      p_issue_type: data.issueType,
    },
  );

  if (error || !created) {
    logIpoError("add-ipo", error?.code);
    return { status: "error", message: SAVE_FAILED_MESSAGE };
  }

  return { status: "success", message: "IPO added.", id: created.id };
}

export async function updateIpoFieldsAction(
  _prevState: IpoActionState,
  formData: FormData,
): Promise<IpoActionState> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { status: "error", message: NOT_SIGNED_IN_MESSAGE };
  }

  const ipoIssueId = readFormString(formData, "ipoIssueId");
  const parsed = updateIpoFieldsSchema.safeParse({
    status: readFormString(formData, "status") || undefined,
    cin: readFormString(formData, "cin") || undefined,
    isin: readFormString(formData, "isin") || undefined,
    exchange: readFormString(formData, "exchange") || undefined,
    industry: readFormString(formData, "industry") || undefined,
    freshIssueAmount: readFormString(formData, "freshIssueAmount") || undefined,
    offerForSaleAmount:
      readFormString(formData, "offerForSaleAmount") || undefined,
    totalIssueSize: readFormString(formData, "totalIssueSize") || undefined,
    faceValue: readFormString(formData, "faceValue") || undefined,
    priceBandMin: readFormString(formData, "priceBandMin") || undefined,
    priceBandMax: readFormString(formData, "priceBandMax") || undefined,
    lotSize: readFormString(formData, "lotSize") || undefined,
    minApplicationQuantity:
      readFormString(formData, "minApplicationQuantity") || undefined,
    issueOpenDate: readFormString(formData, "issueOpenDate") || undefined,
    issueCloseDate: readFormString(formData, "issueCloseDate") || undefined,
    anchorDate: readFormString(formData, "anchorDate") || undefined,
    basisOfAllotmentDate:
      readFormString(formData, "basisOfAllotmentDate") || undefined,
    refundDate: readFormString(formData, "refundDate") || undefined,
    dematCreditDate: readFormString(formData, "dematCreditDate") || undefined,
    listingDate: readFormString(formData, "listingDate") || undefined,
    finalIssuePrice: readFormString(formData, "finalIssuePrice") || undefined,
  });
  if (!ipoIssueId || !parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: parsed.success ? {} : fieldErrorsFromZod(parsed.error),
    };
  }

  const supabase = await createSupabaseServerClient();
  const data = parsed.data;
  const { error } = await supabase.rpc("update_ipo_official_fields", {
    p_ipo_issue_id: ipoIssueId,
    ...(data.status ? { p_status: data.status } : {}),
    ...(data.cin ? { p_cin: data.cin } : {}),
    ...(data.isin ? { p_isin: data.isin } : {}),
    ...(data.exchange ? { p_exchange: data.exchange } : {}),
    ...(data.industry ? { p_industry: data.industry } : {}),
    ...(data.freshIssueAmount !== undefined
      ? { p_fresh_issue_amount: data.freshIssueAmount }
      : {}),
    ...(data.offerForSaleAmount !== undefined
      ? { p_offer_for_sale_amount: data.offerForSaleAmount }
      : {}),
    ...(data.totalIssueSize !== undefined
      ? { p_total_issue_size: data.totalIssueSize }
      : {}),
    ...(data.faceValue !== undefined ? { p_face_value: data.faceValue } : {}),
    ...(data.priceBandMin !== undefined
      ? { p_price_band_min: data.priceBandMin }
      : {}),
    ...(data.priceBandMax !== undefined
      ? { p_price_band_max: data.priceBandMax }
      : {}),
    ...(data.lotSize !== undefined ? { p_lot_size: data.lotSize } : {}),
    ...(data.minApplicationQuantity !== undefined
      ? { p_min_application_quantity: data.minApplicationQuantity }
      : {}),
    ...(data.issueOpenDate ? { p_issue_open_date: data.issueOpenDate } : {}),
    ...(data.issueCloseDate ? { p_issue_close_date: data.issueCloseDate } : {}),
    ...(data.anchorDate ? { p_anchor_date: data.anchorDate } : {}),
    ...(data.basisOfAllotmentDate
      ? { p_basis_of_allotment_date: data.basisOfAllotmentDate }
      : {}),
    ...(data.refundDate ? { p_refund_date: data.refundDate } : {}),
    ...(data.dematCreditDate
      ? { p_demat_credit_date: data.dematCreditDate }
      : {}),
    ...(data.listingDate ? { p_listing_date: data.listingDate } : {}),
    ...(data.finalIssuePrice !== undefined
      ? { p_final_issue_price: data.finalIssuePrice }
      : {}),
  });

  if (error) {
    logIpoError("update-ipo-fields", error.code);
    if (error.code === "42501") {
      return {
        status: "error",
        message: "Only the person who added this IPO can update it.",
      };
    }
    return { status: "error", message: SAVE_FAILED_MESSAGE };
  }

  return { status: "success", message: "IPO updated." };
}

export async function linkIpoToInstrumentAction(
  _prevState: IpoActionState,
  formData: FormData,
): Promise<IpoActionState> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { status: "error", message: NOT_SIGNED_IN_MESSAGE };
  }

  const ipoIssueId = readFormString(formData, "ipoIssueId");
  const instrumentId = readFormString(formData, "instrumentId");
  if (!ipoIssueId || !instrumentId) {
    return { status: "error", message: SAVE_FAILED_MESSAGE };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("link_ipo_to_market_instrument", {
    p_ipo_issue_id: ipoIssueId,
    p_instrument_id: instrumentId,
  });

  if (error) {
    logIpoError("link-ipo", error.code);
    return { status: "error", message: SAVE_FAILED_MESSAGE };
  }

  return { status: "success", message: "Linked to the listed instrument." };
}

export async function addIpoDocumentAction(
  _prevState: IpoActionState,
  formData: FormData,
): Promise<IpoActionState> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { status: "error", message: NOT_SIGNED_IN_MESSAGE };
  }

  const ipoIssueId = readFormString(formData, "ipoIssueId");
  const parsed = addIpoDocumentSchema.safeParse({
    documentType: readFormString(formData, "documentType"),
    title: readFormString(formData, "title"),
    sourceUrl: readFormString(formData, "sourceUrl"),
    sourceOrganization: readFormString(formData, "sourceOrganization"),
    filingDate: readFormString(formData, "filingDate") || undefined,
    sourcePageUrl: readFormString(formData, "sourcePageUrl") || undefined,
  });
  if (!ipoIssueId || !parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: parsed.success ? {} : fieldErrorsFromZod(parsed.error),
    };
  }

  const supabase = await createSupabaseServerClient();
  const data = parsed.data;
  const { data: created, error } = await supabase.rpc("add_ipo_document", {
    p_ipo_issue_id: ipoIssueId,
    p_document_type: data.documentType,
    p_title: data.title,
    p_source_url: data.sourceUrl,
    p_source_organization: data.sourceOrganization,
    ...(data.filingDate ? { p_filing_date: data.filingDate } : {}),
    ...(data.sourcePageUrl ? { p_source_page_url: data.sourcePageUrl } : {}),
  });

  if (error || !created) {
    logIpoError("add-ipo-document", error?.code);
    return { status: "error", message: SAVE_FAILED_MESSAGE };
  }

  return { status: "success", message: "Document link added.", id: created.id };
}

export async function addIpoFinancialMetricAction(
  _prevState: IpoActionState,
  formData: FormData,
): Promise<IpoActionState> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { status: "error", message: NOT_SIGNED_IN_MESSAGE };
  }

  const ipoIssueId = readFormString(formData, "ipoIssueId");
  const parsed = addIpoFinancialMetricSchema.safeParse({
    metricKey: readFormString(formData, "metricKey"),
    fiscalPeriodEnd: readFormString(formData, "fiscalPeriodEnd"),
    value: readFormString(formData, "value"),
    statementBasis: readFormString(formData, "statementBasis") || undefined,
    unitScale: readFormString(formData, "unitScale") || undefined,
    currency: readFormString(formData, "currency") || undefined,
    sourceDocumentId: readFormString(formData, "sourceDocumentId"),
    sourceCitation: readFormString(formData, "sourceCitation") || undefined,
  });
  if (!ipoIssueId || !parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: parsed.success ? {} : fieldErrorsFromZod(parsed.error),
    };
  }

  const supabase = await createSupabaseServerClient();
  const data = parsed.data;
  const { error } = await supabase.rpc("add_ipo_financial_metric", {
    p_ipo_issue_id: ipoIssueId,
    p_metric_key: data.metricKey,
    p_fiscal_period_end: data.fiscalPeriodEnd,
    p_value: data.value,
    p_statement_basis: data.statementBasis,
    p_unit_scale: data.unitScale,
    p_currency: data.currency,
    ...(data.sourceDocumentId
      ? { p_source_document_id: data.sourceDocumentId }
      : {}),
    ...(data.sourceCitation ? { p_source_citation: data.sourceCitation } : {}),
  });

  if (error) {
    logIpoError("add-ipo-financial-metric", error.code);
    return { status: "error", message: SAVE_FAILED_MESSAGE };
  }

  return { status: "success", message: "Financial figure saved." };
}

export async function watchIpoAction(
  _prevState: IpoActionState,
  formData: FormData,
): Promise<IpoActionState> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { status: "error", message: NOT_SIGNED_IN_MESSAGE };
  }

  const parsed = watchIpoSchema.safeParse({
    ipoIssueId: readFormString(formData, "ipoIssueId"),
    priority: readFormString(formData, "priority") || undefined,
  });
  if (!parsed.success) {
    return { status: "error", message: SAVE_FAILED_MESSAGE };
  }

  const supabase = await createSupabaseServerClient();
  const data = parsed.data;
  const { error } = await supabase.from("ipo_watchlist_items").insert({
    user_id: user.id,
    ipo_issue_id: data.ipoIssueId,
    priority: data.priority,
  });

  if (error) {
    logIpoError("watch-ipo", error.code);
    if (error.code === "23505") {
      return {
        status: "error",
        message: "This IPO is already on your watchlist.",
      };
    }
    return { status: "error", message: SAVE_FAILED_MESSAGE };
  }

  return { status: "success", message: "Added to your IPO watchlist." };
}

export async function unwatchIpoAction(
  _prevState: IpoActionState,
  formData: FormData,
): Promise<IpoActionState> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { status: "error", message: NOT_SIGNED_IN_MESSAGE };
  }

  const watchlistItemId = readFormString(formData, "watchlistItemId");
  if (!watchlistItemId) {
    return { status: "error", message: SAVE_FAILED_MESSAGE };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("ipo_watchlist_items")
    .delete()
    .eq("id", watchlistItemId);

  if (error) {
    logIpoError("unwatch-ipo", error.code);
    return { status: "error", message: SAVE_FAILED_MESSAGE };
  }

  return { status: "success", message: "Removed from your IPO watchlist." };
}

export async function updateIpoWatchlistItemAction(
  _prevState: IpoActionState,
  formData: FormData,
): Promise<IpoActionState> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { status: "error", message: NOT_SIGNED_IN_MESSAGE };
  }

  const watchlistItemId = readFormString(formData, "watchlistItemId");
  const parsed = updateIpoWatchlistItemSchema.safeParse({
    priority: readFormString(formData, "priority") || undefined,
    researchStatus: readFormString(formData, "researchStatus") || undefined,
    targetReviewDate: readFormString(formData, "targetReviewDate") || undefined,
  });
  if (!watchlistItemId || !parsed.success) {
    return { status: "error", message: SAVE_FAILED_MESSAGE };
  }

  const supabase = await createSupabaseServerClient();
  const data = parsed.data;
  const { error } = await supabase
    .from("ipo_watchlist_items")
    .update({
      ...(data.priority ? { priority: data.priority } : {}),
      ...(data.researchStatus ? { research_status: data.researchStatus } : {}),
      ...(data.targetReviewDate !== undefined
        ? { target_review_date: data.targetReviewDate }
        : {}),
    })
    .eq("id", watchlistItemId);

  if (error) {
    logIpoError("update-ipo-watchlist-item", error.code);
    return { status: "error", message: SAVE_FAILED_MESSAGE };
  }

  return { status: "success", message: "Updated." };
}

export async function saveIpoResearchNoteAction(
  _prevState: IpoActionState,
  formData: FormData,
): Promise<IpoActionState> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { status: "error", message: NOT_SIGNED_IN_MESSAGE };
  }

  const parsed = ipoResearchNoteSchema.safeParse({
    ipoIssueId: readFormString(formData, "ipoIssueId"),
    businessOverview: readFormString(formData, "businessOverview") || undefined,
    revenueModel: readFormString(formData, "revenueModel") || undefined,
    industryContext: readFormString(formData, "industryContext") || undefined,
    promotersManagement:
      readFormString(formData, "promotersManagement") || undefined,
    useOfProceeds: readFormString(formData, "useOfProceeds") || undefined,
    strengths: readFormString(formData, "strengths") || undefined,
    risks: readFormString(formData, "risks") || undefined,
    materialLitigations:
      readFormString(formData, "materialLitigations") || undefined,
    relatedPartyConcerns:
      readFormString(formData, "relatedPartyConcerns") || undefined,
    concentrationRisk:
      readFormString(formData, "concentrationRisk") || undefined,
    debtNotes: readFormString(formData, "debtNotes") || undefined,
    cashFlowNotes: readFormString(formData, "cashFlowNotes") || undefined,
    dilutionNotes: readFormString(formData, "dilutionNotes") || undefined,
    valuationObservations:
      readFormString(formData, "valuationObservations") || undefined,
    unansweredQuestions:
      readFormString(formData, "unansweredQuestions") || undefined,
    personalNote: readFormString(formData, "personalNote") || undefined,
    riskChecklist: readFormJsonArray(formData, "riskChecklist"),
    sourceChecklist: readFormJsonArray(formData, "sourceChecklist"),
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
  const payload = {
    business_overview: data.businessOverview ?? null,
    revenue_model: data.revenueModel ?? null,
    industry_context: data.industryContext ?? null,
    promoters_management: data.promotersManagement ?? null,
    use_of_proceeds: data.useOfProceeds ?? null,
    strengths: data.strengths ?? null,
    risks: data.risks ?? null,
    material_litigations: data.materialLitigations ?? null,
    related_party_concerns: data.relatedPartyConcerns ?? null,
    concentration_risk: data.concentrationRisk ?? null,
    debt_notes: data.debtNotes ?? null,
    cash_flow_notes: data.cashFlowNotes ?? null,
    dilution_notes: data.dilutionNotes ?? null,
    valuation_observations: data.valuationObservations ?? null,
    unanswered_questions: data.unansweredQuestions ?? null,
    personal_note: data.personalNote ?? null,
    risk_checklist: data.riskChecklist ?? [],
    source_checklist: data.sourceChecklist ?? [],
  };

  const { data: existing } = await supabase
    .from("ipo_research_notes")
    .select("id")
    .eq("ipo_issue_id", data.ipoIssueId)
    .maybeSingle();

  const { error } = existing
    ? await supabase
        .from("ipo_research_notes")
        .update(payload)
        .eq("id", existing.id)
    : await supabase.from("ipo_research_notes").insert({
        user_id: user.id,
        ipo_issue_id: data.ipoIssueId,
        ...payload,
      });

  if (error) {
    logIpoError("save-ipo-research-note", error.code);
    return { status: "error", message: SAVE_FAILED_MESSAGE };
  }

  return { status: "success", message: "Research note saved." };
}
