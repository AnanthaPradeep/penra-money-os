-- =======================================================================
-- Phase 10 — IPO Tracker, Corporate Events, Automated Research Summaries
-- and Explainable Research Assistant.
--
-- Layering mirrors Phase 9 exactly: shared/provider-or-community-sourced
-- facts (never directly writable by authenticated — only via validated
-- SECURITY DEFINER RPCs or service-role ingestion) vs. private per-user
-- research (RLS-owned, direct RLS-gated CRUD) vs. the untouched ledger.
--
-- IMPORTANT — a real bug was found and fixed in Phase 9: the hosted
-- Supabase platform grants EXECUTE on new functions directly to
-- anon/authenticated (not just via the PUBLIC pseudo-role), so every
-- service-role-only function below explicitly
-- `revoke all on function X from public, anon, authenticated;` — never
-- the shorter (and silently insufficient) `from public` alone.
-- =======================================================================

-- =======================================================================
-- 1. IPO domain — shared, community/official-source-provenanced catalogue
-- =======================================================================
-- ipo_issues is modelled like market_instruments: shared read access for
-- every authenticated user, but never directly INSERT/UPDATE-able — only
-- through add_ipo_from_official_source / update_ipo_official_fields below,
-- which validate the source URL and stamp provenance server-side. This
-- satisfies outcome #2 ("add an IPO manually from an official source")
-- without violating "authenticated cannot write shared IPO facts"
-- (section 21) — the raw table has no such grant either way.

create table if not exists public.ipo_issues (
  id uuid primary key default gen_random_uuid(),
  issuer_name text not null,
  cin text null,
  isin text null,
  board text not null default 'mainboard',
  exchange text null,
  industry text null,
  issue_type text not null default 'fresh_and_ofs',
  fresh_issue_amount numeric(20, 4) null,
  offer_for_sale_amount numeric(20, 4) null,
  total_issue_size numeric(20, 4) null,
  face_value numeric(20, 4) null,
  price_band_min numeric(20, 4) null,
  price_band_max numeric(20, 4) null,
  lot_size integer null,
  min_application_quantity integer null,
  issue_open_date date null,
  issue_close_date date null,
  anchor_date date null,
  basis_of_allotment_date date null,
  refund_date date null,
  demat_credit_date date null,
  listing_date date null,
  final_issue_price numeric(20, 4) null,
  status text not null default 'unknown',
  linked_instrument_id uuid null references public.market_instruments(id) on delete set null,
  linked_confirmed_at timestamptz null,
  source_organization text not null,
  source_url text not null,
  added_by_user_id uuid not null references auth.users(id) on delete restrict,
  last_verified_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint ipo_issues_issuer_name_length check (char_length(btrim(issuer_name)) between 1 and 200),
  constraint ipo_issues_board_valid check (board in ('mainboard', 'sme')),
  constraint ipo_issues_issue_type_valid check (issue_type in ('fresh_issue', 'offer_for_sale', 'fresh_and_ofs')),
  constraint ipo_issues_status_valid check (
    status in (
      'draft_filed', 'sebi_observation', 'rhp_filed', 'open', 'closed',
      'allotment_pending', 'allotted', 'listed', 'withdrawn', 'cancelled', 'unknown'
    )
  ),
  constraint ipo_issues_source_org_valid check (source_organization in ('sebi', 'nse', 'bse', 'issuer_ir', 'other_official')),
  constraint ipo_issues_source_url_https check (source_url like 'https://%'),
  constraint ipo_issues_source_url_length check (char_length(source_url) between 1 and 2048),
  constraint ipo_issues_price_band_order check (
    price_band_min is null or price_band_max is null or price_band_min <= price_band_max
  ),
  constraint ipo_issues_issue_dates_order check (
    issue_open_date is null or issue_close_date is null or issue_open_date <= issue_close_date
  ),
  constraint ipo_issues_lot_size_positive check (lot_size is null or lot_size > 0),
  constraint ipo_issues_amounts_nonnegative check (
    (fresh_issue_amount is null or fresh_issue_amount >= 0) and
    (offer_for_sale_amount is null or offer_for_sale_amount >= 0) and
    (total_issue_size is null or total_issue_size >= 0)
  )
);

comment on table public.ipo_issues is
  'Shared IPO catalogue — every authenticated user can read every row, but only add_ipo_from_official_source/update_ipo_official_fields (both SECURITY DEFINER, validated) can write it. Never directly INSERT/UPDATE-able by authenticated. linked_instrument_id is only set post-listing via an explicit confirmed link — never inferred from name similarity, and linking never creates a holding.';

create index if not exists ipo_issues_status_idx on public.ipo_issues (status, issue_open_date);
create index if not exists ipo_issues_board_idx on public.ipo_issues (board, status);
create unique index if not exists ipo_issues_isin_unique on public.ipo_issues (isin) where isin is not null;

drop trigger if exists set_ipo_issues_updated_at on public.ipo_issues;
create trigger set_ipo_issues_updated_at
  before update on public.ipo_issues
  for each row
  execute function public.set_updated_at();

-- Append-only lifecycle audit — populated only by the AAER trigger below,
-- never directly writable.
create table if not exists public.ipo_status_history (
  id uuid primary key default gen_random_uuid(),
  ipo_issue_id uuid not null references public.ipo_issues(id) on delete cascade,
  previous_status text null,
  new_status text not null,
  changed_by_user_id uuid null references auth.users(id) on delete set null,
  note text null,
  changed_at timestamptz not null default now(),

  constraint ipo_status_history_note_length check (note is null or char_length(note) <= 500)
);

comment on table public.ipo_status_history is
  'Append-only — one row per ipo_issues.status transition, written only by log_ipo_status_change() below. Never updated or deleted, so it stays a genuine audit trail even if a later correction changes the status again.';

create index if not exists ipo_status_history_issue_idx on public.ipo_status_history (ipo_issue_id, changed_at desc);

create or replace function public.log_ipo_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.ipo_status_history (ipo_issue_id, previous_status, new_status, changed_by_user_id)
    values (new.id, null, new.status, new.added_by_user_id);
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status then
    insert into public.ipo_status_history (ipo_issue_id, previous_status, new_status, changed_by_user_id)
    values (new.id, old.status, new.status, coalesce((select auth.uid()), new.added_by_user_id));
  end if;
  return new;
end;
$$;

drop trigger if exists log_ipo_status_change_trigger on public.ipo_issues;
create trigger log_ipo_status_change_trigger
  after insert or update on public.ipo_issues
  for each row
  execute function public.log_ipo_status_change();

-- =======================================================================
-- 2. IPO documents — shared, community-contributed official-source links
-- =======================================================================

create table if not exists public.ipo_documents (
  id uuid primary key default gen_random_uuid(),
  ipo_issue_id uuid not null references public.ipo_issues(id) on delete cascade,
  document_type text not null,
  title text not null,
  filing_date date null,
  source_url text not null,
  source_organization text not null,
  source_page_url text null,
  content_hash text null,
  retrieved_at timestamptz null,
  is_verified boolean not null default false,
  supersedes_document_id uuid null references public.ipo_documents(id) on delete set null,
  added_by_user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),

  constraint ipo_documents_type_valid check (
    document_type in (
      'drhp', 'updated_drhp', 'rhp', 'abridged_prospectus', 'final_prospectus',
      'corrigendum', 'sebi_observation', 'issue_summary', 'other_official'
    )
  ),
  constraint ipo_documents_title_length check (char_length(btrim(title)) between 1 and 200),
  constraint ipo_documents_source_url_https check (source_url like 'https://%'),
  constraint ipo_documents_source_url_length check (char_length(source_url) between 1 and 2048),
  constraint ipo_documents_source_org_valid check (source_organization in ('sebi', 'nse', 'bse', 'issuer_ir', 'other_official'))
);

comment on table public.ipo_documents is
  'Shared, manually-linked official document metadata. This app never server-fetches an arbitrary user-supplied URL for parsing — content_hash/retrieved_at are only populated when a document was legitimately downloaded through the SSRF-safe fetcher (see section 3 of the spec); a row with both null simply means "linked, not retrieved". A source link being present is not proof its content was ever parsed.';

create index if not exists ipo_documents_issue_idx on public.ipo_documents (ipo_issue_id, document_type);

-- =======================================================================
-- 3. IPO financial metrics — shared, source-cited historical issuer data
-- =======================================================================

create table if not exists public.ipo_financial_metrics (
  id uuid primary key default gen_random_uuid(),
  ipo_issue_id uuid not null references public.ipo_issues(id) on delete cascade,
  metric_key text not null,
  fiscal_period_end date not null,
  statement_basis text not null default 'consolidated',
  value numeric(24, 4) not null,
  unit_scale text not null default 'unit',
  currency text not null default 'INR',
  source_document_id uuid null references public.ipo_documents(id) on delete set null,
  source_citation text null,
  extraction_method text not null default 'manual_entry',
  human_verified boolean not null default true,
  added_by_user_id uuid not null references auth.users(id) on delete restrict,
  is_current boolean not null default true,
  superseded_by uuid null references public.ipo_financial_metrics(id),
  created_at timestamptz not null default now(),

  constraint ipo_financial_metrics_key_valid check (
    metric_key in (
      'revenue', 'profit_after_tax', 'total_assets', 'total_liabilities', 'shareholder_equity',
      'borrowings', 'operating_cash_flow', 'eps', 'nav_per_share',
      'pre_issue_shares', 'post_issue_shares', 'promoter_holding_pre_issue_percent',
      'promoter_holding_post_issue_percent'
    )
  ),
  constraint ipo_financial_metrics_basis_valid check (statement_basis in ('consolidated', 'standalone')),
  constraint ipo_financial_metrics_unit_scale_valid check (unit_scale in ('unit', 'thousand', 'million', 'crore', 'lakh')),
  constraint ipo_financial_metrics_extraction_valid check (extraction_method in ('manual_entry', 'ocr', 'provider_api')),
  constraint ipo_financial_metrics_citation_length check (source_citation is null or char_length(source_citation) <= 300)
);

comment on table public.ipo_financial_metrics is
  'One row per (issue, metric, period) observation, source-cited and never overwritten in place — a correction supersedes the prior row via superseded_by, exactly mirroring company_financial_metrics. human_verified defaults true because a manually-typed-in figure already passed through a human reading the source document; it would only ever be false for a hypothetical future automated-extraction pipeline output pending review.';

create unique index if not exists ipo_financial_metrics_unique_current
  on public.ipo_financial_metrics (ipo_issue_id, metric_key, fiscal_period_end, statement_basis)
  where is_current = true;
create index if not exists ipo_financial_metrics_issue_idx on public.ipo_financial_metrics (ipo_issue_id) where is_current = true;

-- =======================================================================
-- 4. IPO watchlist items — private, one implicit watchlist per user
-- =======================================================================

create table if not exists public.ipo_watchlist_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  ipo_issue_id uuid not null references public.ipo_issues(id) on delete restrict,
  priority text not null default 'medium',
  research_status text not null default 'unreviewed',
  target_review_date date null,
  added_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint ipo_watchlist_items_priority_valid check (priority in ('low', 'medium', 'high')),
  constraint ipo_watchlist_items_status_valid check (
    research_status in ('unreviewed', 'researching', 'watching', 'not_interested', 'review_complete', 'archived')
  )
);

comment on table public.ipo_watchlist_items is
  'A single, private, implicit IPO watchlist per user (unlike Phase 9''s multi-list company watchlists) — row existence IS the "watch" state. "Apply"/"buy" is deliberately not a status value anywhere in this table.';

create unique index if not exists ipo_watchlist_items_unique on public.ipo_watchlist_items (user_id, ipo_issue_id);
create index if not exists ipo_watchlist_items_user_idx on public.ipo_watchlist_items (user_id, research_status);

drop trigger if exists set_ipo_watchlist_items_updated_at on public.ipo_watchlist_items;
create trigger set_ipo_watchlist_items_updated_at
  before update on public.ipo_watchlist_items
  for each row
  execute function public.set_updated_at();

-- =======================================================================
-- 5. IPO research notes — private, one structured research record per
--    (user, ipo) — deliberately unversioned (unlike investment_theses);
--    the spec does not ask for IPO research version history.
-- =======================================================================

create table if not exists public.ipo_research_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  ipo_issue_id uuid not null references public.ipo_issues(id) on delete restrict,
  business_overview text null,
  revenue_model text null,
  industry_context text null,
  promoters_management text null,
  use_of_proceeds text null,
  strengths text null,
  risks text null,
  material_litigations text null,
  related_party_concerns text null,
  concentration_risk text null,
  debt_notes text null,
  cash_flow_notes text null,
  dilution_notes text null,
  valuation_observations text null,
  unanswered_questions text null,
  personal_note text null,
  risk_checklist jsonb not null default '[]'::jsonb,
  source_checklist jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint ipo_research_notes_risk_checklist_is_array check (jsonb_typeof(risk_checklist) = 'array'),
  constraint ipo_research_notes_source_checklist_is_array check (jsonb_typeof(source_checklist) = 'array')
);

comment on table public.ipo_research_notes is
  'One evolving structured research record per (user, IPO) — every field is the user''s own research or a source-grounded summary they reviewed, never advice. risk_checklist/source_checklist are jsonb arrays of {id, label, checked} maintained entirely client-side/app-side; the database only validates the outer shape is an array.';

create unique index if not exists ipo_research_notes_unique on public.ipo_research_notes (user_id, ipo_issue_id);

drop trigger if exists set_ipo_research_notes_updated_at on public.ipo_research_notes;
create trigger set_ipo_research_notes_updated_at
  before update on public.ipo_research_notes
  for each row
  execute function public.set_updated_at();

-- =======================================================================
-- 6. Corporate events — shared, provider/service-role-sourced only.
--    No user-contribution path exists for this table (unlike IPOs) —
--    outcomes 7-10 describe viewing events, never a user "add an event"
--    action, so this mirrors company_financial_metrics exactly: SELECT
--    only for authenticated, writes only via ingest_corporate_event()
--    (service_role only).
-- =======================================================================

create table if not exists public.corporate_events (
  id uuid primary key default gen_random_uuid(),
  instrument_id uuid not null references public.market_instruments(id) on delete cascade,
  event_type text not null,
  title text not null,
  announcement_at timestamptz null,
  effective_date date null,
  ex_date date null,
  record_date date null,
  payment_date date null,
  meeting_or_result_date date null,
  details jsonb not null default '{}'::jsonb,
  status text not null default 'confirmed',
  source text not null,
  official_url text null,
  provider_event_id text null,
  received_at timestamptz not null default now(),
  is_current boolean not null default true,
  superseded_by uuid null references public.corporate_events(id),
  created_at timestamptz not null default now(),

  constraint corporate_events_type_valid check (
    event_type in (
      'announcement', 'financial_results', 'board_meeting', 'dividend', 'stock_split',
      'bonus_issue', 'rights_issue', 'buyback', 'merger_or_demerger', 'fund_raising',
      'shareholding_update', 'management_change', 'credit_rating',
      'insider_trading_disclosure', 'regulatory_action', 'other'
    )
  ),
  constraint corporate_events_title_length check (char_length(btrim(title)) between 1 and 300),
  constraint corporate_events_status_valid check (status in ('scheduled', 'confirmed', 'completed', 'postponed', 'cancelled')),
  constraint corporate_events_details_is_object check (jsonb_typeof(details) = 'object'),
  constraint corporate_events_official_url_https check (official_url is null or official_url like 'https://%')
);

comment on table public.corporate_events is
  'Shared, service-role-ingested corporate actions/announcements — never directly writable by authenticated. Cancellation is recorded as status=''cancelled'' and stays visible (never deleted). A correction supersedes the prior row via superseded_by/is_current, exactly like market_prices; same-value re-ingest is a no-op. details holds event-type-specific structured values (dividend amount, split/bonus ratio, rights price, buyback size, ...) as a typed-at-the-app-layer jsonb object — never used to alter the ledger or any holding.';

create index if not exists corporate_events_instrument_idx on public.corporate_events (instrument_id, event_type) where is_current = true;
create index if not exists corporate_events_dates_idx on public.corporate_events (ex_date, record_date) where is_current = true;
create unique index if not exists corporate_events_provider_unique
  on public.corporate_events (instrument_id, source, provider_event_id)
  where is_current = true and provider_event_id is not null;
create unique index if not exists corporate_events_superseded_by_unique
  on public.corporate_events (superseded_by) where superseded_by is not null;

-- =======================================================================
-- 7. Extend research_review_events (Phase 9) to also cover IPO
--    watchlist/research/status decision-log entries — reuses the existing
--    generic related_table/related_id pointer rather than a new table.
--    instrument_id stays null for pre-listing IPO events (an IPO usually
--    has no market_instruments row yet); ipo_issue_id is a new nullable
--    column for that case.
-- =======================================================================

alter table public.research_review_events
  add column if not exists ipo_issue_id uuid null references public.ipo_issues(id) on delete set null;

create index if not exists research_review_events_ipo_idx
  on public.research_review_events (ipo_issue_id, occurred_at desc);

alter table public.research_review_events drop constraint if exists research_review_events_type_valid;
alter table public.research_review_events add constraint research_review_events_type_valid check (
  event_type in (
    'watchlist_item_added', 'watchlist_item_removed', 'note_created', 'note_archived',
    'thesis_created', 'thesis_version_added', 'thesis_status_changed',
    'idea_created', 'idea_status_changed', 'filing_added', 'review_completed',
    'ipo_watchlist_item_added', 'ipo_watchlist_item_removed', 'ipo_research_updated',
    'ipo_status_changed', 'ai_job_completed', 'ai_output_accepted', 'ai_output_rejected'
  )
);

create or replace function public.log_ipo_watchlist_item_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.research_review_events (user_id, ipo_issue_id, event_type, related_table, related_id, summary)
    values (new.user_id, new.ipo_issue_id, 'ipo_watchlist_item_added', 'ipo_watchlist_items', new.id, null);
  elsif tg_op = 'DELETE' then
    insert into public.research_review_events (user_id, ipo_issue_id, event_type, related_table, related_id, summary)
    values (old.user_id, old.ipo_issue_id, 'ipo_watchlist_item_removed', 'ipo_watchlist_items', old.id, null);
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists log_ipo_watchlist_item_event_trigger on public.ipo_watchlist_items;
create trigger log_ipo_watchlist_item_event_trigger
  after insert or delete on public.ipo_watchlist_items
  for each row
  execute function public.log_ipo_watchlist_item_event();

create or replace function public.log_ipo_research_note_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.research_review_events (user_id, ipo_issue_id, event_type, related_table, related_id, summary)
  values (new.user_id, new.ipo_issue_id, 'ipo_research_updated', 'ipo_research_notes', new.id, null);
  return new;
end;
$$;

drop trigger if exists log_ipo_research_note_event_trigger on public.ipo_research_notes;
create trigger log_ipo_research_note_event_trigger
  after insert or update on public.ipo_research_notes
  for each row
  execute function public.log_ipo_research_note_event();

-- =======================================================================
-- 8. Source document chunks — private, user-transcribed excerpts used as
--    AI citation targets. No automated PDF text-extraction pipeline
--    exists in this environment (no OCR tooling, no legitimate document
--    download has ever occurred) — see the Phase 10 report's honest scope
--    note. A chunk is always a human-typed excerpt the user themselves
--    copied from a document they were reading, which is why it stays
--    private/per-user rather than shared: transcription accuracy varies
--    per person, and one user's mistake must never poison another user's
--    AI citations. Exactly one of ipo_document_id/company_filing_id must
--    be set.
-- =======================================================================

create table if not exists public.source_document_chunks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  ipo_document_id uuid null references public.ipo_documents(id) on delete cascade,
  company_filing_id uuid null references public.company_filings(id) on delete cascade,
  page_number integer null,
  section_heading text null,
  content_text text not null,
  content_hash text not null,
  extraction_status text not null default 'manual',
  extractor_version text not null default 'manual-transcription-v1',
  created_at timestamptz not null default now(),

  constraint source_document_chunks_exactly_one_parent check (
    (ipo_document_id is not null)::integer + (company_filing_id is not null)::integer = 1
  ),
  constraint source_document_chunks_content_length check (char_length(content_text) between 1 and 8000),
  constraint source_document_chunks_page_positive check (page_number is null or page_number > 0),
  constraint source_document_chunks_extraction_status_valid check (extraction_status in ('manual'))
);

comment on table public.source_document_chunks is
  'A human-transcribed excerpt of an official document, used as the bounded, citable input to an AI job — the assistant is retrieval-grounded over these rows, never given unrestricted database access. extraction_status is currently always ''manual'' (no automated PDF extraction/OCR pipeline exists yet); the column exists so a future, explicitly-approved automated extractor can be distinguished from human-typed text without a schema change.';

create index if not exists source_document_chunks_user_idx on public.source_document_chunks (user_id, created_at desc);
create index if not exists source_document_chunks_ipo_document_idx on public.source_document_chunks (ipo_document_id) where ipo_document_id is not null;
create index if not exists source_document_chunks_filing_idx on public.source_document_chunks (company_filing_id) where company_filing_id is not null;

-- =======================================================================
-- 9. AI provider/model registry — shared, informational catalogue of what
--    the adapter layer supports. is_enabled is false for every row in
--    this environment because no AI provider credential exists — see the
--    Phase 10 report. Seeding these rows documents supported providers;
--    it does not configure, select, or fabricate a live credential.
-- =======================================================================

create table if not exists public.ai_provider_models (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  model_id text not null,
  capability text not null,
  max_input_tokens integer not null,
  max_output_tokens integer not null,
  timeout_seconds integer not null default 60,
  fallback_model_id text null,
  cost_per_1k_input_usd numeric(10, 6) null,
  cost_per_1k_output_usd numeric(10, 6) null,
  per_job_max_output_tokens integer not null,
  daily_spend_cap_usd numeric(10, 2) not null default 0,
  monthly_spend_cap_usd numeric(10, 2) not null default 0,
  is_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint ai_provider_models_provider_valid check (provider in ('openai', 'anthropic')),
  constraint ai_provider_models_capability_valid check (capability in ('chat_completion', 'chat_completion_with_citations')),
  constraint ai_provider_models_unique unique (provider, model_id)
);

comment on table public.ai_provider_models is
  'Shared, read-only-to-authenticated catalogue of AI provider/model configuration — centralizes token limits, timeout, cost metadata, and spend caps so every AI call goes through one registry rather than hard-coded constants scattered across call sites. is_enabled=false for every seeded row in this environment: no AI provider credential exists, so nothing here is live. Never directly writable by authenticated.';

drop trigger if exists set_ai_provider_models_updated_at on public.ai_provider_models;
create trigger set_ai_provider_models_updated_at
  before update on public.ai_provider_models
  for each row
  execute function public.set_updated_at();

insert into public.ai_provider_models (
  provider, model_id, capability, max_input_tokens, max_output_tokens, timeout_seconds,
  per_job_max_output_tokens, daily_spend_cap_usd, monthly_spend_cap_usd, is_enabled
) values
  ('openai', 'gpt-4o-mini', 'chat_completion_with_citations', 120000, 8000, 90, 2000, 2.00, 30.00, false),
  ('anthropic', 'claude-haiku-4-5', 'chat_completion_with_citations', 180000, 8000, 90, 2000, 2.00, 30.00, false)
on conflict (provider, model_id) do nothing;

-- =======================================================================
-- 10. AI job ledger — private, per-user. Every AI call in this app must
--     go through this table (queued -> processing -> completed/failed/
--     cancelled/blocked) so every generation is auditable, capped, and
--     reviewable before it can touch any research record.
-- =======================================================================

create table if not exists public.ai_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_kind text not null,
  provider text not null,
  model_id text not null,
  status text not null default 'queued',
  scope_type text not null,
  scope_instrument_id uuid null references public.market_instruments(id) on delete set null,
  scope_ipo_issue_id uuid null references public.ipo_issues(id) on delete set null,
  scope_compare_instrument_ids uuid[] null,
  question_text text null,
  prompt_template_version text not null,
  input_hash text not null,
  output_hash text null,
  requested_at timestamptz not null default now(),
  started_at timestamptz null,
  completed_at timestamptz null,
  input_tokens integer null,
  output_tokens integer null,
  estimated_cost_usd numeric(10, 4) null,
  duration_ms integer null,
  error_code text null,
  retry_count integer not null default 0,
  human_review_status text null,

  constraint ai_jobs_kind_valid check (
    job_kind in (
      'document_summary', 'company_update_summary', 'ipo_summary',
      'risk_extraction', 'research_question', 'thesis_change_review'
    )
  ),
  constraint ai_jobs_provider_valid check (provider in ('openai', 'anthropic')),
  constraint ai_jobs_status_valid check (status in ('queued', 'processing', 'completed', 'failed', 'cancelled', 'blocked')),
  constraint ai_jobs_scope_type_valid check (scope_type in ('company', 'ipo', 'documents', 'comparison')),
  constraint ai_jobs_scope_consistent check (
    (scope_type = 'company' and scope_instrument_id is not null) or
    (scope_type = 'ipo' and scope_ipo_issue_id is not null) or
    (scope_type = 'comparison' and scope_compare_instrument_ids is not null and array_length(scope_compare_instrument_ids, 1) between 2 and 5) or
    (scope_type = 'documents')
  ),
  constraint ai_jobs_question_length check (question_text is null or char_length(question_text) <= 2000),
  constraint ai_jobs_human_review_status_valid check (
    human_review_status is null or human_review_status in ('accepted_all', 'accepted_partial', 'rejected')
  ),
  constraint ai_jobs_retry_count_nonnegative check (retry_count >= 0)
);

comment on table public.ai_jobs is
  'One row per AI generation attempt. status tracks the job''s own lifecycle; human_review_status (set only after completion) tracks whether the user accepted/edited/rejected the output — see ai_job_outputs.accepted for per-section granularity ("Accept selected sections"). Never stores a provider API key, authorization header, or unrestricted raw request/response log — only the safe audit fields listed in the Phase 10 spec.';

create index if not exists ai_jobs_user_idx on public.ai_jobs (user_id, requested_at desc);
create index if not exists ai_jobs_status_idx on public.ai_jobs (status) where status in ('queued', 'processing');

-- Prevents duplicate concurrent jobs for the same user/source-set/kind/
-- prompt-version — input_hash is computed app-side from the sorted
-- source id list + job_kind + prompt_template_version (+ question_text
-- for research_question jobs).
create unique index if not exists ai_jobs_no_duplicate_concurrent
  on public.ai_jobs (user_id, input_hash)
  where status in ('queued', 'processing');

create table if not exists public.ai_job_sources (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.ai_jobs(id) on delete cascade,
  chunk_id uuid not null references public.source_document_chunks(id) on delete restrict,
  created_at timestamptz not null default now(),

  constraint ai_job_sources_unique unique (job_id, chunk_id)
);

comment on table public.ai_job_sources is
  'The bounded, explicit set of source_document_chunks a job is authorized to cite — the AI worker and the citation validator both treat this as the complete allowed source set for the job; a citation referencing any chunk outside this set is rejected (see validate_ai_job_citations()).';

create index if not exists ai_job_sources_job_idx on public.ai_job_sources (job_id);

create table if not exists public.ai_job_outputs (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.ai_jobs(id) on delete cascade,
  section_type text not null,
  content text not null,
  citations jsonb not null default '[]'::jsonb,
  display_order integer not null default 0,
  accepted boolean not null default false,
  accepted_at timestamptz null,
  is_user_edited boolean not null default false,
  saved_as_table text null,
  saved_as_id uuid null,
  created_at timestamptz not null default now(),

  constraint ai_job_outputs_section_valid check (
    section_type in ('facts', 'interpretations', 'risks', 'unknowns', 'questions_for_review')
  ),
  constraint ai_job_outputs_content_length check (char_length(content) <= 8000),
  constraint ai_job_outputs_citations_is_array check (jsonb_typeof(citations) = 'array'),
  constraint ai_job_outputs_saved_as_table_valid check (
    saved_as_table is null or saved_as_table in ('research_notes', 'ipo_research_notes')
  )
);

comment on table public.ai_job_outputs is
  'One row per typed section of an AI job''s output (facts/interpretations/risks/unknowns/questions_for_review — "source_citations" is rendered app-side as the deduplicated union of every section''s citations, not stored as its own row). citations is a jsonb array of chunk-id strings, each validated to belong to ai_job_sources for the same job before the job is ever marked completed. accepted/is_user_edited/saved_as_* record the mandatory human-review outcome for this specific section — never set automatically.';

create index if not exists ai_job_outputs_job_idx on public.ai_job_outputs (job_id, display_order);

create table if not exists public.ai_usage_daily (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null,
  jobs_count integer not null default 0,
  input_tokens bigint not null default 0,
  output_tokens bigint not null default 0,
  estimated_cost_usd numeric(10, 4) not null default 0,
  updated_at timestamptz not null default now(),

  constraint ai_usage_daily_unique unique (user_id, usage_date),
  constraint ai_usage_daily_nonnegative check (jobs_count >= 0 and input_tokens >= 0 and output_tokens >= 0 and estimated_cost_usd >= 0)
);

comment on table public.ai_usage_daily is
  'One row per (user, day) — incremented only by complete_ai_job()/fail_ai_job() when a job finishes, never by the client. Read by create_ai_job() to enforce the daily spend cap from ai_provider_models before a new job is even queued.';

-- Add AI-provenance columns to the two private research tables that can
-- receive human-reviewed AI content — never set by anything other than
-- accept_ai_job_output() below.
alter table public.research_notes
  add column if not exists source_ai_job_id uuid null references public.ai_jobs(id) on delete set null,
  add column if not exists is_ai_reviewed_edited boolean not null default false;

alter table public.ipo_research_notes
  add column if not exists source_ai_job_id uuid null references public.ai_jobs(id) on delete set null,
  add column if not exists is_ai_reviewed_edited boolean not null default false;

-- =======================================================================
-- 11. RLS — forced on every new table. Design, per table:
--
--   Shared, RPC/service-role-mediated-write-only (SELECT for authenticated,
--   ZERO direct insert/update/delete grants — every write goes through a
--   SECURITY DEFINER function owned by the migration role, which bypasses
--   RLS the same way every existing Phase 1-9 ingestion RPC already does):
--     ipo_issues, ipo_documents, ipo_financial_metrics, ipo_status_history,
--     corporate_events, ai_provider_models.
--
--   Private, direct RLS-gated CRUD by owner (mirrors watchlist_items/
--   research_notes exactly, including column-scoped update grants):
--     ipo_watchlist_items, ipo_research_notes, source_document_chunks.
--
--   Private, but even more conservative: SELECT-only for authenticated
--   (own rows) with ZERO direct write grants at all — job creation,
--   status transitions, and output acceptance are only ever done through
--   validated SECURITY DEFINER RPCs (create_ai_job/complete_ai_job/
--   accept_ai_job_output/...), never a raw client insert/update, so a
--   user can never forge their own job's provider/model/token/cost
--   metadata or mark it "completed" with unvalidated output:
--     ai_jobs, ai_job_sources, ai_job_outputs, ai_usage_daily.
-- =======================================================================

alter table public.ipo_issues enable row level security;
alter table public.ipo_issues force row level security;
alter table public.ipo_status_history enable row level security;
alter table public.ipo_status_history force row level security;
alter table public.ipo_documents enable row level security;
alter table public.ipo_documents force row level security;
alter table public.ipo_financial_metrics enable row level security;
alter table public.ipo_financial_metrics force row level security;
alter table public.ipo_watchlist_items enable row level security;
alter table public.ipo_watchlist_items force row level security;
alter table public.ipo_research_notes enable row level security;
alter table public.ipo_research_notes force row level security;
alter table public.corporate_events enable row level security;
alter table public.corporate_events force row level security;
alter table public.source_document_chunks enable row level security;
alter table public.source_document_chunks force row level security;
alter table public.ai_provider_models enable row level security;
alter table public.ai_provider_models force row level security;
alter table public.ai_jobs enable row level security;
alter table public.ai_jobs force row level security;
alter table public.ai_job_sources enable row level security;
alter table public.ai_job_sources force row level security;
alter table public.ai_job_outputs enable row level security;
alter table public.ai_job_outputs force row level security;
alter table public.ai_usage_daily enable row level security;
alter table public.ai_usage_daily force row level security;

-- --- Shared, read-only-to-authenticated tables ---

drop policy if exists ipo_issues_select on public.ipo_issues;
create policy ipo_issues_select on public.ipo_issues for select to authenticated using (true);
revoke all on public.ipo_issues from public, anon, authenticated;
grant select on public.ipo_issues to authenticated;

drop policy if exists ipo_status_history_select on public.ipo_status_history;
create policy ipo_status_history_select on public.ipo_status_history for select to authenticated using (true);
revoke all on public.ipo_status_history from public, anon, authenticated;
grant select on public.ipo_status_history to authenticated;

drop policy if exists ipo_documents_select on public.ipo_documents;
create policy ipo_documents_select on public.ipo_documents for select to authenticated using (true);
revoke all on public.ipo_documents from public, anon, authenticated;
grant select on public.ipo_documents to authenticated;

drop policy if exists ipo_financial_metrics_select on public.ipo_financial_metrics;
create policy ipo_financial_metrics_select on public.ipo_financial_metrics for select to authenticated using (true);
revoke all on public.ipo_financial_metrics from public, anon, authenticated;
grant select on public.ipo_financial_metrics to authenticated;

drop policy if exists corporate_events_select on public.corporate_events;
create policy corporate_events_select on public.corporate_events for select to authenticated using (true);
revoke all on public.corporate_events from public, anon, authenticated;
grant select on public.corporate_events to authenticated;

drop policy if exists ai_provider_models_select on public.ai_provider_models;
create policy ai_provider_models_select on public.ai_provider_models for select to authenticated using (true);
revoke all on public.ai_provider_models from public, anon, authenticated;
grant select on public.ai_provider_models to authenticated;

-- --- Private, direct RLS-gated CRUD by owner ---

drop policy if exists ipo_watchlist_items_select on public.ipo_watchlist_items;
create policy ipo_watchlist_items_select on public.ipo_watchlist_items for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists ipo_watchlist_items_insert on public.ipo_watchlist_items;
create policy ipo_watchlist_items_insert on public.ipo_watchlist_items for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists ipo_watchlist_items_update on public.ipo_watchlist_items;
create policy ipo_watchlist_items_update on public.ipo_watchlist_items for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists ipo_watchlist_items_delete on public.ipo_watchlist_items;
create policy ipo_watchlist_items_delete on public.ipo_watchlist_items for delete to authenticated using (user_id = (select auth.uid()));
revoke all on public.ipo_watchlist_items from public, anon, authenticated;
grant select, insert, delete on public.ipo_watchlist_items to authenticated;
grant update (priority, research_status, target_review_date) on public.ipo_watchlist_items to authenticated;

drop policy if exists ipo_research_notes_select on public.ipo_research_notes;
create policy ipo_research_notes_select on public.ipo_research_notes for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists ipo_research_notes_insert on public.ipo_research_notes;
create policy ipo_research_notes_insert on public.ipo_research_notes for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists ipo_research_notes_update on public.ipo_research_notes;
create policy ipo_research_notes_update on public.ipo_research_notes for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke all on public.ipo_research_notes from public, anon, authenticated;
grant select, insert on public.ipo_research_notes to authenticated;
grant update (
  business_overview, revenue_model, industry_context, promoters_management, use_of_proceeds,
  strengths, risks, material_litigations, related_party_concerns, concentration_risk,
  debt_notes, cash_flow_notes, dilution_notes, valuation_observations, unanswered_questions,
  personal_note, risk_checklist, source_checklist
) on public.ipo_research_notes to authenticated;

drop policy if exists source_document_chunks_select on public.source_document_chunks;
create policy source_document_chunks_select on public.source_document_chunks for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists source_document_chunks_insert on public.source_document_chunks;
create policy source_document_chunks_insert on public.source_document_chunks for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists source_document_chunks_delete on public.source_document_chunks;
create policy source_document_chunks_delete on public.source_document_chunks for delete to authenticated using (user_id = (select auth.uid()));
revoke all on public.source_document_chunks from public, anon, authenticated;
grant select, insert, delete on public.source_document_chunks to authenticated;

-- --- Private, SELECT-only-to-authenticated (own rows), RPC-mediated writes ---

drop policy if exists ai_jobs_select on public.ai_jobs;
create policy ai_jobs_select on public.ai_jobs for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.ai_jobs from public, anon, authenticated;
grant select on public.ai_jobs to authenticated;

drop policy if exists ai_job_sources_select on public.ai_job_sources;
create policy ai_job_sources_select on public.ai_job_sources for select to authenticated using (
  exists (select 1 from public.ai_jobs j where j.id = ai_job_sources.job_id and j.user_id = (select auth.uid()))
);
revoke all on public.ai_job_sources from public, anon, authenticated;
grant select on public.ai_job_sources to authenticated;

drop policy if exists ai_job_outputs_select on public.ai_job_outputs;
create policy ai_job_outputs_select on public.ai_job_outputs for select to authenticated using (
  exists (select 1 from public.ai_jobs j where j.id = ai_job_outputs.job_id and j.user_id = (select auth.uid()))
);
revoke all on public.ai_job_outputs from public, anon, authenticated;
grant select on public.ai_job_outputs to authenticated;

drop policy if exists ai_usage_daily_select on public.ai_usage_daily;
create policy ai_usage_daily_select on public.ai_usage_daily for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.ai_usage_daily from public, anon, authenticated;
grant select on public.ai_usage_daily to authenticated;

-- =======================================================================
-- 12. IPO write RPCs — authenticated-callable, validated. These are the
--     ONLY path that can write ipo_issues/ipo_documents/
--     ipo_financial_metrics (the tables themselves grant zero direct
--     write access to authenticated — see section 11).
-- =======================================================================

create or replace function public.add_ipo_from_official_source(
  p_issuer_name text,
  p_board text,
  p_source_organization text,
  p_source_url text,
  p_cin text default null,
  p_isin text default null,
  p_exchange text default null,
  p_industry text default null,
  p_issue_type text default 'fresh_and_ofs',
  p_status text default 'unknown'
)
returns public.ipo_issues
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_row public.ipo_issues;
begin
  if v_user_id is null then
    raise exception 'Sign in required' using errcode = '42501';
  end if;
  if p_source_url !~ '^https://' then
    raise exception 'Source URL must use https://' using errcode = '22023';
  end if;

  insert into public.ipo_issues (
    issuer_name, board, source_organization, source_url, cin, isin, exchange,
    industry, issue_type, status, added_by_user_id
  ) values (
    p_issuer_name, p_board, p_source_organization, p_source_url, p_cin, p_isin, p_exchange,
    p_industry, p_issue_type, p_status, v_user_id
  )
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.add_ipo_from_official_source(text, text, text, text, text, text, text, text, text, text) from public, anon;
grant execute on function public.add_ipo_from_official_source(text, text, text, text, text, text, text, text, text, text) to authenticated;

-- A single broad correction/status-update RPC rather than one function per
-- field — mirrors how update_investment_asset (Phase 7) covers several
-- editable fields in one call. Restricted to the original submitter
-- (added_by_user_id) so a shared community-maintained catalogue entry
-- cannot be overwritten by an unrelated user; every call re-stamps
-- last_verified_at and (via the existing AFTER UPDATE trigger) appends to
-- ipo_status_history whenever status actually changes.
create or replace function public.update_ipo_official_fields(
  p_ipo_issue_id uuid,
  p_status text default null,
  p_cin text default null,
  p_isin text default null,
  p_exchange text default null,
  p_industry text default null,
  p_fresh_issue_amount numeric default null,
  p_offer_for_sale_amount numeric default null,
  p_total_issue_size numeric default null,
  p_face_value numeric default null,
  p_price_band_min numeric default null,
  p_price_band_max numeric default null,
  p_lot_size integer default null,
  p_min_application_quantity integer default null,
  p_issue_open_date date default null,
  p_issue_close_date date default null,
  p_anchor_date date default null,
  p_basis_of_allotment_date date default null,
  p_refund_date date default null,
  p_demat_credit_date date default null,
  p_listing_date date default null,
  p_final_issue_price numeric default null,
  p_source_url text default null
)
returns public.ipo_issues
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_owner uuid;
  v_row public.ipo_issues;
begin
  select added_by_user_id into v_owner from public.ipo_issues where id = p_ipo_issue_id;
  if v_owner is null then
    raise exception 'IPO issue not found' using errcode = 'P0002';
  end if;
  if v_owner is distinct from v_user_id then
    raise exception 'Only the user who added this IPO can update it' using errcode = '42501';
  end if;
  if p_source_url is not null and p_source_url !~ '^https://' then
    raise exception 'Source URL must use https://' using errcode = '22023';
  end if;

  update public.ipo_issues set
    status = coalesce(p_status, status),
    cin = coalesce(p_cin, cin),
    isin = coalesce(p_isin, isin),
    exchange = coalesce(p_exchange, exchange),
    industry = coalesce(p_industry, industry),
    fresh_issue_amount = coalesce(p_fresh_issue_amount, fresh_issue_amount),
    offer_for_sale_amount = coalesce(p_offer_for_sale_amount, offer_for_sale_amount),
    total_issue_size = coalesce(p_total_issue_size, total_issue_size),
    face_value = coalesce(p_face_value, face_value),
    price_band_min = coalesce(p_price_band_min, price_band_min),
    price_band_max = coalesce(p_price_band_max, price_band_max),
    lot_size = coalesce(p_lot_size, lot_size),
    min_application_quantity = coalesce(p_min_application_quantity, min_application_quantity),
    issue_open_date = coalesce(p_issue_open_date, issue_open_date),
    issue_close_date = coalesce(p_issue_close_date, issue_close_date),
    anchor_date = coalesce(p_anchor_date, anchor_date),
    basis_of_allotment_date = coalesce(p_basis_of_allotment_date, basis_of_allotment_date),
    refund_date = coalesce(p_refund_date, refund_date),
    demat_credit_date = coalesce(p_demat_credit_date, demat_credit_date),
    listing_date = coalesce(p_listing_date, listing_date),
    final_issue_price = coalesce(p_final_issue_price, final_issue_price),
    source_url = coalesce(p_source_url, source_url),
    last_verified_at = now()
  where id = p_ipo_issue_id
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.update_ipo_official_fields(
  uuid, text, text, text, text, text, numeric, numeric, numeric, numeric, numeric, numeric,
  integer, integer, date, date, date, date, date, date, date, numeric, text
) from public, anon;
grant execute on function public.update_ipo_official_fields(
  uuid, text, text, text, text, text, numeric, numeric, numeric, numeric, numeric, numeric,
  integer, integer, date, date, date, date, date, date, date, numeric, text
) to authenticated;

-- A confirmed post-listing link to a real stock market_instruments row —
-- explicit only, never inferred from name similarity, and never creates a
-- holding (see spec section 2). Restricted to the IPO's own submitter for
-- the same reason as update_ipo_official_fields.
create or replace function public.link_ipo_to_market_instrument(
  p_ipo_issue_id uuid,
  p_instrument_id uuid
)
returns public.ipo_issues
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_owner uuid;
  v_instrument_kind text;
  v_row public.ipo_issues;
begin
  select added_by_user_id into v_owner from public.ipo_issues where id = p_ipo_issue_id;
  if v_owner is null then
    raise exception 'IPO issue not found' using errcode = 'P0002';
  end if;
  if v_owner is distinct from v_user_id then
    raise exception 'Only the user who added this IPO can link it' using errcode = '42501';
  end if;

  select instrument_kind into v_instrument_kind from public.market_instruments where id = p_instrument_id;
  if v_instrument_kind is distinct from 'stock' then
    raise exception 'Only a stock-kind market instrument can be linked to an IPO' using errcode = '22023';
  end if;

  update public.ipo_issues
  set linked_instrument_id = p_instrument_id, linked_confirmed_at = now()
  where id = p_ipo_issue_id
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.link_ipo_to_market_instrument(uuid, uuid) from public, anon;
grant execute on function public.link_ipo_to_market_instrument(uuid, uuid) to authenticated;

create or replace function public.add_ipo_document(
  p_ipo_issue_id uuid,
  p_document_type text,
  p_title text,
  p_source_url text,
  p_source_organization text,
  p_filing_date date default null,
  p_source_page_url text default null,
  p_supersedes_document_id uuid default null
)
returns public.ipo_documents
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_row public.ipo_documents;
begin
  if v_user_id is null then
    raise exception 'Sign in required' using errcode = '42501';
  end if;
  if p_source_url !~ '^https://' then
    raise exception 'Source URL must use https://' using errcode = '22023';
  end if;
  if not exists (select 1 from public.ipo_issues where id = p_ipo_issue_id) then
    raise exception 'IPO issue not found' using errcode = 'P0002';
  end if;

  insert into public.ipo_documents (
    ipo_issue_id, document_type, title, filing_date, source_url, source_organization,
    source_page_url, supersedes_document_id, added_by_user_id
  ) values (
    p_ipo_issue_id, p_document_type, p_title, p_filing_date, p_source_url, p_source_organization,
    p_source_page_url, p_supersedes_document_id, v_user_id
  )
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.add_ipo_document(uuid, text, text, text, text, date, text, uuid) from public, anon;
grant execute on function public.add_ipo_document(uuid, text, text, text, text, date, text, uuid) to authenticated;

-- Same supersede/idempotent-correction pattern as
-- ingest_company_financial_metric (Phase 9), scoped to one IPO instead of
-- one company-financial-period.
create or replace function public.add_ipo_financial_metric(
  p_ipo_issue_id uuid,
  p_metric_key text,
  p_fiscal_period_end date,
  p_value numeric,
  p_statement_basis text default 'consolidated',
  p_unit_scale text default 'unit',
  p_currency text default 'INR',
  p_source_document_id uuid default null,
  p_source_citation text default null
)
returns public.ipo_financial_metrics
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_existing public.ipo_financial_metrics;
  v_inserted public.ipo_financial_metrics;
begin
  if v_user_id is null then
    raise exception 'Sign in required' using errcode = '42501';
  end if;
  if not exists (select 1 from public.ipo_issues where id = p_ipo_issue_id) then
    raise exception 'IPO issue not found' using errcode = 'P0002';
  end if;

  select * into v_existing
  from public.ipo_financial_metrics
  where ipo_issue_id = p_ipo_issue_id and metric_key = p_metric_key
    and fiscal_period_end = p_fiscal_period_end and statement_basis = p_statement_basis
    and is_current = true
  for update;

  if v_existing.id is not null and v_existing.value = p_value and v_existing.unit_scale = p_unit_scale then
    return v_existing;
  end if;

  if v_existing.id is not null then
    update public.ipo_financial_metrics set is_current = false where id = v_existing.id;
  end if;

  insert into public.ipo_financial_metrics (
    ipo_issue_id, metric_key, fiscal_period_end, statement_basis, value, unit_scale, currency,
    source_document_id, source_citation, extraction_method, human_verified, added_by_user_id
  ) values (
    p_ipo_issue_id, p_metric_key, p_fiscal_period_end, p_statement_basis, p_value, p_unit_scale, p_currency,
    p_source_document_id, p_source_citation, 'manual_entry', true, v_user_id
  )
  returning * into v_inserted;

  if v_existing.id is not null then
    update public.ipo_financial_metrics set superseded_by = v_inserted.id where id = v_existing.id;
  end if;

  return v_inserted;
end;
$$;

revoke all on function public.add_ipo_financial_metric(uuid, text, date, numeric, text, text, text, uuid, text) from public, anon;
grant execute on function public.add_ipo_financial_metric(uuid, text, date, numeric, text, text, text, uuid, text) to authenticated;

-- =======================================================================
-- 13. Corporate event ingestion — service_role only. No user-contribution
--     path exists for this table (see section 6's comment); this mirrors
--     ingest_market_price_observation's supersede/idempotent-correction
--     pattern exactly.
-- =======================================================================

create or replace function public.ingest_corporate_event(
  p_instrument_id uuid,
  p_event_type text,
  p_title text,
  p_source text,
  p_status text default 'confirmed',
  p_announcement_at timestamptz default null,
  p_effective_date date default null,
  p_ex_date date default null,
  p_record_date date default null,
  p_payment_date date default null,
  p_meeting_or_result_date date default null,
  p_details jsonb default '{}'::jsonb,
  p_official_url text default null,
  p_provider_event_id text default null
)
returns public.corporate_events
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing public.corporate_events;
  v_inserted public.corporate_events;
begin
  if p_provider_event_id is not null then
    select * into v_existing
    from public.corporate_events
    where instrument_id = p_instrument_id and source = p_source
      and provider_event_id = p_provider_event_id and is_current = true
    for update;
  end if;

  if v_existing.id is not null
     and v_existing.title = p_title and v_existing.status = p_status
     and v_existing.details = p_details
     and v_existing.ex_date is not distinct from p_ex_date
     and v_existing.record_date is not distinct from p_record_date
     and v_existing.payment_date is not distinct from p_payment_date
     and v_existing.effective_date is not distinct from p_effective_date
     and v_existing.meeting_or_result_date is not distinct from p_meeting_or_result_date
  then
    return v_existing;
  end if;

  if v_existing.id is not null then
    update public.corporate_events set is_current = false where id = v_existing.id;
  end if;

  insert into public.corporate_events (
    instrument_id, event_type, title, source, status, announcement_at, effective_date,
    ex_date, record_date, payment_date, meeting_or_result_date, details, official_url, provider_event_id
  ) values (
    p_instrument_id, p_event_type, p_title, p_source, p_status, p_announcement_at, p_effective_date,
    p_ex_date, p_record_date, p_payment_date, p_meeting_or_result_date, p_details, p_official_url, p_provider_event_id
  )
  returning * into v_inserted;

  if v_existing.id is not null then
    update public.corporate_events set superseded_by = v_inserted.id where id = v_existing.id;
  end if;

  return v_inserted;
end;
$$;

revoke all on function public.ingest_corporate_event(
  uuid, text, text, text, text, timestamptz, date, date, date, date, date, jsonb, text, text
) from public, anon, authenticated;
grant execute on function public.ingest_corporate_event(
  uuid, text, text, text, text, timestamptz, date, date, date, date, date, jsonb, text, text
) to service_role;

-- =======================================================================
-- 14. AI job ledger RPCs.
--
-- create_ai_job is the ONLY way an authenticated user can queue a job —
-- it independently re-verifies the model is enabled and the spend cap
-- before insert (never trusts the client's own cap check), verifies every
-- cited chunk belongs to the caller (an authenticated user can never cite
-- -- or even discover the existence of -- another user's chunk), and
-- relies on ai_jobs_no_duplicate_concurrent to reject a duplicate
-- concurrent request cleanly.
--
-- start_ai_job/complete_ai_job/block_ai_job/fail_ai_job are service_role
-- only — the Edge Function worker's own boundary; an authenticated client
-- can never mark its own job "completed" with self-supplied output,
-- tokens, or cost.
-- =======================================================================

create or replace function public.create_ai_job(
  p_job_kind text,
  p_provider text,
  p_model_id text,
  p_scope_type text,
  p_prompt_template_version text,
  p_input_hash text,
  p_chunk_ids uuid[] default '{}',
  p_scope_instrument_id uuid default null,
  p_scope_ipo_issue_id uuid default null,
  p_scope_compare_instrument_ids uuid[] default null,
  p_question_text text default null
)
returns table (job_id uuid, queued boolean, reason text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_model public.ai_provider_models;
  v_usage public.ai_usage_daily;
  v_unauthorized_chunk_count integer;
  v_new_job_id uuid;
begin
  if v_user_id is null then
    raise exception 'Sign in required' using errcode = '42501';
  end if;

  select * into v_model from public.ai_provider_models where provider = p_provider and model_id = p_model_id;
  if v_model.id is null or v_model.is_enabled is not true then
    job_id := null; queued := false; reason := 'provider_not_configured';
    return next;
    return;
  end if;

  select * into v_usage from public.ai_usage_daily where user_id = v_user_id and usage_date = current_date;
  if v_usage.id is not null and (
       v_usage.estimated_cost_usd >= v_model.daily_spend_cap_usd
    ) then
    job_id := null; queued := false; reason := 'daily_spend_cap_exceeded';
    return next;
    return;
  end if;

  if array_length(p_chunk_ids, 1) is not null then
    select count(*) into v_unauthorized_chunk_count
    from unnest(p_chunk_ids) as chunk_id
    where not exists (
      select 1 from public.source_document_chunks c
      where c.id = chunk_id and c.user_id = v_user_id
    );
    if v_unauthorized_chunk_count > 0 then
      raise exception 'One or more source chunks are not authorized for this user' using errcode = '42501';
    end if;
  end if;

  begin
    insert into public.ai_jobs (
      user_id, job_kind, provider, model_id, status, scope_type, scope_instrument_id,
      scope_ipo_issue_id, scope_compare_instrument_ids, question_text,
      prompt_template_version, input_hash
    ) values (
      v_user_id, p_job_kind, p_provider, p_model_id, 'queued', p_scope_type, p_scope_instrument_id,
      p_scope_ipo_issue_id, p_scope_compare_instrument_ids, p_question_text,
      p_prompt_template_version, p_input_hash
    )
    returning id into v_new_job_id;
  exception when unique_violation then
    job_id := null; queued := false; reason := 'duplicate_job_in_progress';
    return next;
    return;
  end;

  if array_length(p_chunk_ids, 1) is not null then
    insert into public.ai_job_sources (job_id, chunk_id)
    select v_new_job_id, chunk_id from unnest(p_chunk_ids) as chunk_id;
  end if;

  job_id := v_new_job_id; queued := true; reason := null;
  return next;
end;
$$;

revoke all on function public.create_ai_job(text, text, text, text, text, text, uuid[], uuid, uuid, uuid[], text) from public, anon;
grant execute on function public.create_ai_job(text, text, text, text, text, text, uuid[], uuid, uuid, uuid[], text) to authenticated;

create or replace function public.start_ai_job(p_job_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.ai_jobs set status = 'processing', started_at = now()
  where id = p_job_id and status = 'queued';
$$;

revoke all on function public.start_ai_job(uuid) from public, anon, authenticated;
grant execute on function public.start_ai_job(uuid) to service_role;

-- Validates every output's citations belong to the job's authorized
-- source set BEFORE inserting anything or marking the job complete — see
-- spec section 10 ("Reject completed output when citations fail
-- validation"). p_outputs shape: jsonb array of
-- {section_type, content, citations: [chunk_id, ...], display_order}.
create or replace function public.complete_ai_job(
  p_job_id uuid,
  p_output_hash text,
  p_input_tokens integer,
  p_output_tokens integer,
  p_estimated_cost_usd numeric,
  p_duration_ms integer,
  p_outputs jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_output record;
  v_citation text;
  v_invalid_citation_count integer;
begin
  select user_id into v_user_id from public.ai_jobs where id = p_job_id;
  if v_user_id is null then
    raise exception 'AI job not found' using errcode = 'P0002';
  end if;

  for v_output in select * from jsonb_to_recordset(p_outputs) as x(
    section_type text, content text, citations jsonb, display_order integer
  )
  loop
    if v_output.citations is not null and jsonb_typeof(v_output.citations) = 'array' then
      for v_citation in select jsonb_array_elements_text(v_output.citations)
      loop
        if not exists (
          select 1 from public.ai_job_sources s
          where s.job_id = p_job_id and s.chunk_id = v_citation::uuid
        ) then
          raise exception 'Citation % is not in this job''s authorized source set', v_citation using errcode = '22023';
        end if;
      end loop;
    end if;
  end loop;

  insert into public.ai_job_outputs (job_id, section_type, content, citations, display_order)
  select p_job_id, x.section_type, x.content, coalesce(x.citations, '[]'::jsonb), coalesce(x.display_order, 0)
  from jsonb_to_recordset(p_outputs) as x(section_type text, content text, citations jsonb, display_order integer);

  update public.ai_jobs set
    status = 'completed',
    completed_at = now(),
    output_hash = p_output_hash,
    input_tokens = p_input_tokens,
    output_tokens = p_output_tokens,
    estimated_cost_usd = p_estimated_cost_usd,
    duration_ms = p_duration_ms
  where id = p_job_id;

  insert into public.ai_usage_daily (user_id, usage_date, jobs_count, input_tokens, output_tokens, estimated_cost_usd)
  values (v_user_id, current_date, 1, coalesce(p_input_tokens, 0), coalesce(p_output_tokens, 0), coalesce(p_estimated_cost_usd, 0))
  on conflict (user_id, usage_date) do update set
    jobs_count = public.ai_usage_daily.jobs_count + 1,
    input_tokens = public.ai_usage_daily.input_tokens + coalesce(p_input_tokens, 0),
    output_tokens = public.ai_usage_daily.output_tokens + coalesce(p_output_tokens, 0),
    estimated_cost_usd = public.ai_usage_daily.estimated_cost_usd + coalesce(p_estimated_cost_usd, 0),
    updated_at = now();
end;
$$;

revoke all on function public.complete_ai_job(uuid, text, integer, integer, numeric, integer, jsonb) from public, anon, authenticated;
grant execute on function public.complete_ai_job(uuid, text, integer, integer, numeric, integer, jsonb) to service_role;

-- Marks a job blocked (citations failed validation, prompt-injection
-- detected, or an advice/trade-instruction request was refused) —
-- distinct from a plain failure so the audit trail shows a safety
-- decision was made, not a transient error.
create or replace function public.block_ai_job(p_job_id uuid, p_error_code text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.ai_jobs set status = 'blocked', completed_at = now(), error_code = p_error_code
  where id = p_job_id;
$$;

revoke all on function public.block_ai_job(uuid, text) from public, anon, authenticated;
grant execute on function public.block_ai_job(uuid, text) to service_role;

create or replace function public.fail_ai_job(p_job_id uuid, p_error_code text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.ai_jobs set
    status = 'failed',
    completed_at = now(),
    error_code = p_error_code,
    retry_count = retry_count + 1
  where id = p_job_id;
$$;

revoke all on function public.fail_ai_job(uuid, text) from public, anon, authenticated;
grant execute on function public.fail_ai_job(uuid, text) to service_role;

-- Human review — mandatory, per-section. Never called automatically.
create or replace function public.accept_ai_job_output(
  p_output_id uuid,
  p_edited_content text default null
)
returns public.ai_job_outputs
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_owner uuid;
  v_row public.ai_job_outputs;
begin
  select j.user_id into v_owner
  from public.ai_job_outputs o join public.ai_jobs j on j.id = o.job_id
  where o.id = p_output_id;

  if v_owner is null then
    raise exception 'AI job output not found' using errcode = 'P0002';
  end if;
  if v_owner is distinct from v_user_id then
    raise exception 'Only the job''s own user can review its output' using errcode = '42501';
  end if;

  update public.ai_job_outputs set
    content = coalesce(p_edited_content, content),
    is_user_edited = (p_edited_content is not null and p_edited_content is distinct from content),
    accepted = true,
    accepted_at = now()
  where id = p_output_id
  returning * into v_row;

  update public.ai_jobs set human_review_status = 'accepted_partial' where id = v_row.job_id and human_review_status is distinct from 'accepted_all';

  return v_row;
end;
$$;

revoke all on function public.accept_ai_job_output(uuid, text) from public, anon;
grant execute on function public.accept_ai_job_output(uuid, text) to authenticated;

create or replace function public.reject_ai_job(p_job_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_owner uuid;
begin
  select user_id into v_owner from public.ai_jobs where id = p_job_id;
  if v_owner is null then
    raise exception 'AI job not found' using errcode = 'P0002';
  end if;
  if v_owner is distinct from v_user_id then
    raise exception 'Only the job''s own user can reject its output' using errcode = '42501';
  end if;

  update public.ai_jobs set human_review_status = 'rejected' where id = p_job_id;
end;
$$;

revoke all on function public.reject_ai_job(uuid) from public, anon;
grant execute on function public.reject_ai_job(uuid) to authenticated;

-- =======================================================================
-- 15. Refresh orchestration + Cron. research_sync_runs generalizes
--     fundamentals_sync_runs/market_data_sync_runs to the three new
--     scopes below, rather than three near-identical single-purpose
--     tables — RLS/grants follow the exact same "fully locked down, zero
--     client access" pattern as those two precedents (see the "RLS
--     Enabled No Policy" INFO-level advisory already accepted for them).
-- =======================================================================

create table if not exists public.research_sync_runs (
  id uuid primary key default gen_random_uuid(),
  scope text not null,
  status text not null default 'running',
  items_requested integer not null default 0,
  items_updated integer not null default 0,
  items_skipped integer not null default 0,
  error_code text null,
  triggered_by_user_id uuid null references auth.users(id) on delete set null,
  started_at timestamptz not null default now(),
  completed_at timestamptz null,

  constraint research_sync_runs_scope_valid check (
    scope in ('corporate_events_refresh', 'ai_job_cleanup', 'research_summary_refresh')
  ),
  constraint research_sync_runs_status_valid check (status in ('running', 'success', 'partial', 'failed', 'skipped'))
);

comment on table public.research_sync_runs is
  'Observability for Phase 10 background jobs, generalizing fundamentals_sync_runs/market_data_sync_runs to one table across the corporate-events/AI-cleanup/research-summary scopes. RLS enabled with zero policies (matching those two precedents) — never readable or writable by any client role, only service_role/postgres.';

alter table public.research_sync_runs enable row level security;
alter table public.research_sync_runs force row level security;
revoke all on public.research_sync_runs from public, anon, authenticated;

create index if not exists research_sync_runs_scope_idx on public.research_sync_runs (scope, started_at desc);

-- Bulk-expires AI jobs stuck in queued/processing past a generous
-- timeout (worker crash, Edge Function cold-start failure, etc.) — the
-- only one of the three new background jobs that is genuinely operational
-- regardless of whether any AI provider is configured.
create or replace function public.run_ai_job_cleanup()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_run_id uuid;
  v_updated integer;
begin
  insert into public.research_sync_runs (scope, status)
  values ('ai_job_cleanup', 'running')
  returning id into v_run_id;

  with expired as (
    update public.ai_jobs
    set status = 'failed', completed_at = now(), error_code = 'timed_out'
    where status in ('queued', 'processing') and requested_at < now() - interval '30 minutes'
    returning id
  )
  select count(*) into v_updated from expired;

  update public.research_sync_runs
  set status = 'success', items_updated = v_updated, completed_at = now()
  where id = v_run_id;
end;
$$;

revoke all on function public.run_ai_job_cleanup() from public, anon, authenticated;
grant execute on function public.run_ai_job_cleanup() to service_role;

-- Corporate events refresh — checks provider configuration first (see
-- market_data_provider_state, reused as-is from Phase 8/9: the
-- 'twelve_data' row already exists and this scope shares it, since it is
-- the same underlying provider account) and only dispatches to the Edge
-- Function when configured, exactly mirroring
-- run_fundamentals_refresh/process_company_fundamentals_refresh_all's
-- honest not-configured boundary.
create or replace function public.process_corporate_events_refresh_all()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_configured boolean;
  v_ids uuid[];
begin
  select is_configured into v_configured from public.market_data_provider_state where provider = 'twelve_data';

  if v_configured is not true then
    insert into public.research_sync_runs (scope, status, error_code, completed_at)
    values ('corporate_events_refresh', 'skipped', 'provider_not_configured', now());
    return;
  end if;

  select array_agg(distinct mi.id) into v_ids
  from public.market_instruments mi
  where mi.instrument_kind = 'stock' and mi.is_active = true
    and (
      exists (select 1 from public.investment_assets a where a.market_instrument_id = mi.id)
      or exists (select 1 from public.watchlist_items wi where wi.instrument_id = mi.id)
    );

  if v_ids is null or array_length(v_ids, 1) is null then
    insert into public.research_sync_runs (scope, status, error_code, completed_at)
    values ('corporate_events_refresh', 'skipped', 'no_instruments', now());
    return;
  end if;

  perform public.invoke_market_data_function(
    'corporate-events-refresh',
    jsonb_build_object('instrument_ids', to_jsonb(v_ids))
  );
end;
$$;

revoke all on function public.process_corporate_events_refresh_all() from public, anon, authenticated;
grant execute on function public.process_corporate_events_refresh_all() to service_role;

-- Research summary refresh — checks whether any AI model is enabled
-- before doing anything; always skips cleanly in this environment (no AI
-- provider configured). Deliberately does not auto-queue any job today —
-- writing the auto-queue selection logic against a provider that has
-- never been exercised live would risk "runaway recursive summarization"
-- (spec section 16) without any way to verify it behaves; the honest
-- current behaviour is to record a truthful skip.
create or replace function public.process_research_summary_refresh_all()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_any_enabled boolean;
begin
  select exists(select 1 from public.ai_provider_models where is_enabled = true) into v_any_enabled;

  if v_any_enabled is not true then
    insert into public.research_sync_runs (scope, status, error_code, completed_at)
    values ('research_summary_refresh', 'skipped', 'provider_not_configured', now());
    return;
  end if;

  insert into public.research_sync_runs (scope, status, error_code, completed_at)
  values ('research_summary_refresh', 'skipped', 'auto_queue_not_implemented', now());
end;
$$;

revoke all on function public.process_research_summary_refresh_all() from public, anon, authenticated;
grant execute on function public.process_research_summary_refresh_all() to service_role;

-- pg_cron registration. penra-ipo-source-refresh is deliberately NOT
-- created: there is no automated feed to poll (SEBI/NSE/BSE offer no
-- documented public API, and no licensed provider is configured), and
-- source/document staleness is computed live at query time from
-- last_verified_at/retrieved_at rather than mutated by a batch job — a
-- Cron job with nothing genuinely operational to do would be exactly the
-- "misleading successful Cron entry" the spec warns against creating.
select cron.schedule(
  'penra-corporate-events-refresh',
  '0 12 * * *',
  $$select public.process_corporate_events_refresh_all();$$
);
select cron.schedule(
  'penra-ai-job-cleanup',
  '*/15 * * * *',
  $$select public.run_ai_job_cleanup();$$
);
select cron.schedule(
  'penra-research-summary-refresh',
  '30 12 * * *',
  $$select public.process_research_summary_refresh_all();$$
);

-- =======================================================================
-- 16. AI decision-log triggers — reuse research_review_events (section 7)
--     for AI job completion/acceptance/rejection, exactly like every
--     other Phase 9/10 decision-log entry.
-- =======================================================================

create or replace function public.log_ai_job_completed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.status is distinct from old.status and new.status = 'completed' then
    insert into public.research_review_events (
      user_id, instrument_id, ipo_issue_id, event_type, related_table, related_id, summary
    )
    values (
      new.user_id, new.scope_instrument_id, new.scope_ipo_issue_id, 'ai_job_completed',
      'ai_jobs', new.id, new.job_kind || ' completed'
    );
  elsif tg_op = 'UPDATE' and new.human_review_status is distinct from old.human_review_status
        and new.human_review_status = 'rejected' then
    insert into public.research_review_events (
      user_id, instrument_id, ipo_issue_id, event_type, related_table, related_id, summary
    )
    values (
      new.user_id, new.scope_instrument_id, new.scope_ipo_issue_id, 'ai_output_rejected',
      'ai_jobs', new.id, new.job_kind || ' output rejected'
    );
  end if;
  return new;
end;
$$;

drop trigger if exists log_ai_job_completed_trigger on public.ai_jobs;
create trigger log_ai_job_completed_trigger
  after update on public.ai_jobs
  for each row
  execute function public.log_ai_job_completed();

create or replace function public.log_ai_output_accepted()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.ai_jobs;
begin
  if tg_op = 'UPDATE' and new.accepted is distinct from old.accepted and new.accepted = true then
    select * into v_job from public.ai_jobs where id = new.job_id;
    insert into public.research_review_events (
      user_id, instrument_id, ipo_issue_id, event_type, related_table, related_id, summary
    )
    values (
      v_job.user_id, v_job.scope_instrument_id, v_job.scope_ipo_issue_id, 'ai_output_accepted',
      'ai_job_outputs', new.id, new.section_type || ' accepted'
    );
  end if;
  return new;
end;
$$;

drop trigger if exists log_ai_output_accepted_trigger on public.ai_job_outputs;
create trigger log_ai_output_accepted_trigger
  after update on public.ai_job_outputs
  for each row
  execute function public.log_ai_output_accepted();
