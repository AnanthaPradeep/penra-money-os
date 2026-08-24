"use server";

import type { z } from "zod";

import { getAuthenticatedUser } from "@/lib/auth/session";
import type { ResearchActionState } from "@/lib/research/action-state";
import {
  companyFilingSchema,
  investmentIdeaSchema,
  investmentThesisSchema,
  researchNoteSchema,
  updateInvestmentIdeaSchema,
  updateInvestmentThesisSchema,
  updateResearchNoteSchema,
  updateWatchlistItemSchema,
  watchlistItemSchema,
  watchlistSchema,
} from "@/lib/research/schema";
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
function logResearchError(context: string, code: string | undefined): void {
  if (process.env.NODE_ENV === "production") {
    return;
  }
  console.error(`[research:${context}]`, { code: code ?? "unknown" });
}

const NOT_SIGNED_IN_MESSAGE = "You need to sign in again to manage research.";
const SAVE_FAILED_MESSAGE = "We couldn't save that. Please try again.";
const DELETE_FAILED_MESSAGE = "We couldn't remove that. Please try again.";

// ---------------------------------------------------------------------
// Watchlists
// ---------------------------------------------------------------------

export async function createWatchlistAction(
  _prevState: ResearchActionState,
  formData: FormData,
): Promise<ResearchActionState> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { status: "error", message: NOT_SIGNED_IN_MESSAGE };
  }

  const parsed = watchlistSchema.safeParse({
    name: readFormString(formData, "name"),
    description: readFormString(formData, "description"),
    color: readFormString(formData, "color") || undefined,
    icon: readFormString(formData, "icon") || undefined,
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
  const { data: created, error } = await supabase
    .from("watchlists")
    .insert({
      user_id: user.id,
      name: data.name,
      description: data.description ?? null,
      color: data.color,
      icon: data.icon,
    })
    .select("id")
    .single();

  if (error || !created) {
    logResearchError("create-watchlist", error?.code);
    return { status: "error", message: SAVE_FAILED_MESSAGE };
  }

  return { status: "success", message: "Watchlist created.", id: created.id };
}

export async function updateWatchlistAction(
  _prevState: ResearchActionState,
  formData: FormData,
): Promise<ResearchActionState> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { status: "error", message: NOT_SIGNED_IN_MESSAGE };
  }

  const watchlistId = readFormString(formData, "watchlistId");
  const parsed = watchlistSchema.safeParse({
    name: readFormString(formData, "name"),
    description: readFormString(formData, "description"),
    color: readFormString(formData, "color") || undefined,
    icon: readFormString(formData, "icon") || undefined,
  });
  if (!watchlistId || !parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: parsed.success ? {} : fieldErrorsFromZod(parsed.error),
    };
  }

  const supabase = await createSupabaseServerClient();
  const data = parsed.data;
  const { error } = await supabase
    .from("watchlists")
    .update({
      name: data.name,
      description: data.description ?? null,
      color: data.color,
      icon: data.icon,
    })
    .eq("id", watchlistId);

  if (error) {
    logResearchError("update-watchlist", error.code);
    return { status: "error", message: SAVE_FAILED_MESSAGE };
  }

  return { status: "success", message: "Watchlist updated." };
}

export async function setWatchlistArchivedAction(
  _prevState: ResearchActionState,
  formData: FormData,
): Promise<ResearchActionState> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { status: "error", message: NOT_SIGNED_IN_MESSAGE };
  }

  const watchlistId = readFormString(formData, "watchlistId");
  const status =
    readFormString(formData, "status") === "archived" ? "archived" : "active";
  if (!watchlistId) {
    return { status: "error", message: SAVE_FAILED_MESSAGE };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("watchlists")
    .update({ status })
    .eq("id", watchlistId);

  if (error) {
    logResearchError("set-watchlist-status", error.code);
    return { status: "error", message: SAVE_FAILED_MESSAGE };
  }

  return { status: "success", message: "Watchlist updated." };
}

export async function deleteWatchlistAction(
  _prevState: ResearchActionState,
  formData: FormData,
): Promise<ResearchActionState> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { status: "error", message: NOT_SIGNED_IN_MESSAGE };
  }

  const watchlistId = readFormString(formData, "watchlistId");
  if (!watchlistId) {
    return { status: "error", message: DELETE_FAILED_MESSAGE };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("watchlists")
    .delete()
    .eq("id", watchlistId);

  if (error) {
    logResearchError("delete-watchlist", error.code);
    return { status: "error", message: DELETE_FAILED_MESSAGE };
  }

  return { status: "success", message: "Watchlist deleted." };
}

// ---------------------------------------------------------------------
// Watchlist items
// ---------------------------------------------------------------------

export async function addWatchlistItemAction(
  _prevState: ResearchActionState,
  formData: FormData,
): Promise<ResearchActionState> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { status: "error", message: NOT_SIGNED_IN_MESSAGE };
  }

  const parsed = watchlistItemSchema.safeParse({
    watchlistId: readFormString(formData, "watchlistId"),
    instrumentId: readFormString(formData, "instrumentId"),
    priority: readFormString(formData, "priority") || undefined,
    targetReviewDate: readFormString(formData, "targetReviewDate") || undefined,
  });
  if (!parsed.success) {
    return { status: "error", message: SAVE_FAILED_MESSAGE };
  }

  const supabase = await createSupabaseServerClient();
  const data = parsed.data;
  const { error } = await supabase.from("watchlist_items").insert({
    watchlist_id: data.watchlistId,
    // Overwritten server-side by set_watchlist_item_user_id_trigger from
    // the watchlist's real owner — passed here only to satisfy the NOT
    // NULL column/type, never trusted as the actual authorization check.
    user_id: user.id,
    instrument_id: data.instrumentId,
    priority: data.priority,
    target_review_date: data.targetReviewDate ?? null,
  });

  if (error) {
    logResearchError("add-watchlist-item", error.code);
    if (error.code === "23505") {
      return {
        status: "error",
        message: "This is already on that watchlist.",
      };
    }
    return { status: "error", message: SAVE_FAILED_MESSAGE };
  }

  return { status: "success", message: "Added to watchlist." };
}

export async function updateWatchlistItemAction(
  _prevState: ResearchActionState,
  formData: FormData,
): Promise<ResearchActionState> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { status: "error", message: NOT_SIGNED_IN_MESSAGE };
  }

  const itemId = readFormString(formData, "itemId");
  const parsed = updateWatchlistItemSchema.safeParse({
    priority: readFormString(formData, "priority") || undefined,
    targetReviewDate: readFormString(formData, "targetReviewDate") || undefined,
    researchStatus: readFormString(formData, "researchStatus") || undefined,
  });
  if (!itemId || !parsed.success) {
    return { status: "error", message: SAVE_FAILED_MESSAGE };
  }

  const supabase = await createSupabaseServerClient();
  const data = parsed.data;
  const { error } = await supabase
    .from("watchlist_items")
    .update({
      ...(data.priority ? { priority: data.priority } : {}),
      ...(data.targetReviewDate !== undefined
        ? { target_review_date: data.targetReviewDate }
        : {}),
      ...(data.researchStatus ? { research_status: data.researchStatus } : {}),
    })
    .eq("id", itemId);

  if (error) {
    logResearchError("update-watchlist-item", error.code);
    return { status: "error", message: SAVE_FAILED_MESSAGE };
  }

  return { status: "success", message: "Updated." };
}

export async function removeWatchlistItemAction(
  _prevState: ResearchActionState,
  formData: FormData,
): Promise<ResearchActionState> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { status: "error", message: NOT_SIGNED_IN_MESSAGE };
  }

  const itemId = readFormString(formData, "itemId");
  if (!itemId) {
    return { status: "error", message: DELETE_FAILED_MESSAGE };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("watchlist_items")
    .delete()
    .eq("id", itemId);

  if (error) {
    logResearchError("remove-watchlist-item", error.code);
    return { status: "error", message: DELETE_FAILED_MESSAGE };
  }

  return { status: "success", message: "Removed from watchlist." };
}

// ---------------------------------------------------------------------
// Research notes
// ---------------------------------------------------------------------

export async function createResearchNoteAction(
  _prevState: ResearchActionState,
  formData: FormData,
): Promise<ResearchActionState> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { status: "error", message: NOT_SIGNED_IN_MESSAGE };
  }

  const parsed = researchNoteSchema.safeParse({
    instrumentId: readFormString(formData, "instrumentId"),
    title: readFormString(formData, "title"),
    body: readFormString(formData, "body"),
    noteType: readFormString(formData, "noteType") || undefined,
    sourceUrl: readFormString(formData, "sourceUrl"),
    filingId: readFormString(formData, "filingId"),
    observedDate: readFormString(formData, "observedDate") || undefined,
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
  const { data: created, error } = await supabase
    .from("research_notes")
    .insert({
      user_id: user.id,
      instrument_id: data.instrumentId,
      title: data.title,
      body: data.body,
      note_type: data.noteType,
      source_url: data.sourceUrl ?? null,
      filing_id: data.filingId ?? null,
      observed_date: data.observedDate ?? null,
    })
    .select("id")
    .single();

  if (error || !created) {
    logResearchError("create-note", error?.code);
    return { status: "error", message: SAVE_FAILED_MESSAGE };
  }

  return { status: "success", message: "Note saved.", id: created.id };
}

export async function updateResearchNoteAction(
  _prevState: ResearchActionState,
  formData: FormData,
): Promise<ResearchActionState> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { status: "error", message: NOT_SIGNED_IN_MESSAGE };
  }

  const noteId = readFormString(formData, "noteId");
  const parsed = updateResearchNoteSchema.safeParse({
    title: readFormString(formData, "title"),
    body: readFormString(formData, "body"),
    noteType: readFormString(formData, "noteType") || undefined,
    sourceUrl: readFormString(formData, "sourceUrl"),
    filingId: readFormString(formData, "filingId"),
    observedDate: readFormString(formData, "observedDate") || undefined,
    isPinned: readFormString(formData, "isPinned") || undefined,
    isArchived: readFormString(formData, "isArchived") || undefined,
  });
  if (!noteId || !parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: parsed.success ? {} : fieldErrorsFromZod(parsed.error),
    };
  }

  const supabase = await createSupabaseServerClient();
  const data = parsed.data;
  const { error } = await supabase
    .from("research_notes")
    .update({
      title: data.title,
      body: data.body,
      note_type: data.noteType,
      source_url: data.sourceUrl ?? null,
      filing_id: data.filingId ?? null,
      observed_date: data.observedDate ?? null,
      ...(data.isPinned !== undefined ? { is_pinned: data.isPinned } : {}),
      ...(data.isArchived !== undefined
        ? { is_archived: data.isArchived }
        : {}),
    })
    .eq("id", noteId);

  if (error) {
    logResearchError("update-note", error.code);
    return { status: "error", message: SAVE_FAILED_MESSAGE };
  }

  return { status: "success", message: "Note updated." };
}

// ---------------------------------------------------------------------
// Company filings
// ---------------------------------------------------------------------

export async function createCompanyFilingAction(
  _prevState: ResearchActionState,
  formData: FormData,
): Promise<ResearchActionState> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { status: "error", message: NOT_SIGNED_IN_MESSAGE };
  }

  const parsed = companyFilingSchema.safeParse({
    instrumentId: readFormString(formData, "instrumentId"),
    category: readFormString(formData, "category") || undefined,
    title: readFormString(formData, "title"),
    filingDate: readFormString(formData, "filingDate") || undefined,
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

  const data = parsed.data;
  let sourceDomain: string;
  try {
    sourceDomain = new URL(data.sourceUrl).hostname;
  } catch {
    return { status: "error", message: SAVE_FAILED_MESSAGE };
  }

  const supabase = await createSupabaseServerClient();
  const { data: created, error } = await supabase
    .from("company_filings")
    .insert({
      user_id: user.id,
      instrument_id: data.instrumentId,
      category: data.category,
      title: data.title,
      filing_date: data.filingDate ?? null,
      source_domain: sourceDomain,
      source_url: data.sourceUrl,
      notes: data.notes ?? null,
    })
    .select("id")
    .single();

  if (error || !created) {
    logResearchError("create-filing", error?.code);
    return { status: "error", message: SAVE_FAILED_MESSAGE };
  }

  return { status: "success", message: "Filing link added.", id: created.id };
}

export async function setCompanyFilingVerifiedAction(
  _prevState: ResearchActionState,
  formData: FormData,
): Promise<ResearchActionState> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { status: "error", message: NOT_SIGNED_IN_MESSAGE };
  }

  const filingId = readFormString(formData, "filingId");
  const isVerified = readFormString(formData, "isVerified") === "true";
  if (!filingId) {
    return { status: "error", message: SAVE_FAILED_MESSAGE };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("company_filings")
    .update({ is_verified: isVerified })
    .eq("id", filingId);

  if (error) {
    logResearchError("verify-filing", error.code);
    return { status: "error", message: SAVE_FAILED_MESSAGE };
  }

  return { status: "success", message: "Updated." };
}

// ---------------------------------------------------------------------
// Investment theses
// ---------------------------------------------------------------------

export async function createInvestmentThesisAction(
  _prevState: ResearchActionState,
  formData: FormData,
): Promise<ResearchActionState> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { status: "error", message: NOT_SIGNED_IN_MESSAGE };
  }

  const parsed = investmentThesisSchema.safeParse({
    instrumentId: readFormString(formData, "instrumentId"),
    title: readFormString(formData, "title"),
    summary: readFormString(formData, "summary"),
    investmentCase: readFormString(formData, "investmentCase"),
    opportunities: readFormString(formData, "opportunities"),
    risks: readFormString(formData, "risks"),
    catalysts: readFormString(formData, "catalysts"),
    invalidationConditions: readFormString(formData, "invalidationConditions"),
    expectedReviewDate:
      readFormString(formData, "expectedReviewDate") || undefined,
    timeHorizon: readFormString(formData, "timeHorizon") || undefined,
    confidence: readFormString(formData, "confidence") || undefined,
    status: readFormString(formData, "status") || undefined,
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
  const { data: created, error } = await supabase
    .from("investment_theses")
    .insert({
      user_id: user.id,
      instrument_id: data.instrumentId,
      title: data.title,
      summary: data.summary ?? null,
      investment_case: data.investmentCase ?? null,
      opportunities: data.opportunities ?? null,
      risks: data.risks ?? null,
      catalysts: data.catalysts ?? null,
      invalidation_conditions: data.invalidationConditions ?? null,
      expected_review_date: data.expectedReviewDate ?? null,
      time_horizon: data.timeHorizon,
      confidence: data.confidence,
      status: data.status,
    })
    .select("id")
    .single();

  if (error || !created) {
    logResearchError("create-thesis", error?.code);
    if (error?.code === "23505") {
      return {
        status: "error",
        message: "You already have an active thesis for this company.",
      };
    }
    return { status: "error", message: SAVE_FAILED_MESSAGE };
  }

  return { status: "success", message: "Thesis created.", id: created.id };
}

export async function updateInvestmentThesisAction(
  _prevState: ResearchActionState,
  formData: FormData,
): Promise<ResearchActionState> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { status: "error", message: NOT_SIGNED_IN_MESSAGE };
  }

  const thesisId = readFormString(formData, "thesisId");
  const parsed = updateInvestmentThesisSchema.safeParse({
    title: readFormString(formData, "title"),
    summary: readFormString(formData, "summary"),
    investmentCase: readFormString(formData, "investmentCase"),
    opportunities: readFormString(formData, "opportunities"),
    risks: readFormString(formData, "risks"),
    catalysts: readFormString(formData, "catalysts"),
    invalidationConditions: readFormString(formData, "invalidationConditions"),
    expectedReviewDate:
      readFormString(formData, "expectedReviewDate") || undefined,
    timeHorizon: readFormString(formData, "timeHorizon") || undefined,
    confidence: readFormString(formData, "confidence") || undefined,
    status: readFormString(formData, "status") || undefined,
  });
  if (!thesisId || !parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: parsed.success ? {} : fieldErrorsFromZod(parsed.error),
    };
  }

  const supabase = await createSupabaseServerClient();
  const data = parsed.data;
  const { error } = await supabase
    .from("investment_theses")
    .update({
      title: data.title,
      summary: data.summary ?? null,
      investment_case: data.investmentCase ?? null,
      opportunities: data.opportunities ?? null,
      risks: data.risks ?? null,
      catalysts: data.catalysts ?? null,
      invalidation_conditions: data.invalidationConditions ?? null,
      expected_review_date: data.expectedReviewDate ?? null,
      time_horizon: data.timeHorizon,
      confidence: data.confidence,
      status: data.status,
    })
    .eq("id", thesisId);

  if (error) {
    logResearchError("update-thesis", error.code);
    return { status: "error", message: SAVE_FAILED_MESSAGE };
  }

  return {
    status: "success",
    message: "Thesis updated — a new version was recorded.",
  };
}

// ---------------------------------------------------------------------
// Investment ideas
// ---------------------------------------------------------------------

export async function createInvestmentIdeaAction(
  _prevState: ResearchActionState,
  formData: FormData,
): Promise<ResearchActionState> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { status: "error", message: NOT_SIGNED_IN_MESSAGE };
  }

  const parsed = investmentIdeaSchema.safeParse({
    instrumentId: readFormString(formData, "instrumentId"),
    title: readFormString(formData, "title"),
    priority: readFormString(formData, "priority") || undefined,
    origin: readFormString(formData, "origin"),
    rationale: readFormString(formData, "rationale"),
    riskNotes: readFormString(formData, "riskNotes"),
    nextReviewDate: readFormString(formData, "nextReviewDate") || undefined,
    thesisId: readFormString(formData, "thesisId"),
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
  const { data: created, error } = await supabase
    .from("investment_ideas")
    .insert({
      user_id: user.id,
      instrument_id: data.instrumentId,
      title: data.title,
      priority: data.priority,
      origin: data.origin ?? null,
      rationale: data.rationale ?? null,
      risk_notes: data.riskNotes ?? null,
      next_review_date: data.nextReviewDate ?? null,
      thesis_id: data.thesisId ?? null,
    })
    .select("id")
    .single();

  if (error || !created) {
    logResearchError("create-idea", error?.code);
    return { status: "error", message: SAVE_FAILED_MESSAGE };
  }

  return { status: "success", message: "Idea captured.", id: created.id };
}

export async function updateInvestmentIdeaAction(
  _prevState: ResearchActionState,
  formData: FormData,
): Promise<ResearchActionState> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { status: "error", message: NOT_SIGNED_IN_MESSAGE };
  }

  const ideaId = readFormString(formData, "ideaId");
  const parsed = updateInvestmentIdeaSchema.safeParse({
    title: readFormString(formData, "title"),
    priority: readFormString(formData, "priority") || undefined,
    origin: readFormString(formData, "origin"),
    rationale: readFormString(formData, "rationale"),
    riskNotes: readFormString(formData, "riskNotes"),
    nextReviewDate: readFormString(formData, "nextReviewDate") || undefined,
    thesisId: readFormString(formData, "thesisId"),
    status: readFormString(formData, "status") || undefined,
  });
  if (!ideaId || !parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: parsed.success ? {} : fieldErrorsFromZod(parsed.error),
    };
  }

  const supabase = await createSupabaseServerClient();
  const data = parsed.data;
  const { error } = await supabase
    .from("investment_ideas")
    .update({
      title: data.title,
      priority: data.priority,
      origin: data.origin ?? null,
      rationale: data.rationale ?? null,
      risk_notes: data.riskNotes ?? null,
      next_review_date: data.nextReviewDate ?? null,
      thesis_id: data.thesisId ?? null,
      ...(data.status ? { status: data.status } : {}),
    })
    .eq("id", ideaId);

  if (error) {
    logResearchError("update-idea", error.code);
    return { status: "error", message: SAVE_FAILED_MESSAGE };
  }

  return { status: "success", message: "Idea updated." };
}
