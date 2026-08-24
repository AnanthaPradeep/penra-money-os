-- Phase 9: company fundamentals, watchlists, research workspace, and
-- investment ideas.
--
-- Three distinct layers, never conflated:
--   1. Shared provider-sourced company/fundamental data (company_profiles,
--      company_financial_periods, company_financial_metrics) — globally
--      readable like market_instruments/market_prices, writable only by
--      the service role via trusted ingestion functions.
--   2. Private user research data (watchlists, watchlist_items,
--      research_notes, company_filings, investment_theses,
--      investment_thesis_versions, investment_ideas) — RLS-isolated per
--      user, mostly direct RLS-gated CRUD (mirrors categories/payees),
--      with version/decision history enforced by triggers so it can never
--      be skipped by a client that forgets to call a special RPC.
--   3. Existing private portfolio/ledger data (untouched) — nothing in
--      this migration ever writes to ledger_transactions, ledger_entries,
--      investment_activities, investment_holdings, or investment_assets.
--      A watchlist item is never a holding; approving an investment idea
--      never creates a transaction.
--
-- Company identity reuses Phase 8's public.market_instruments — a
-- "company" for research purposes is simply a market_instruments row with
-- instrument_kind = 'stock'. A mutual-fund scheme is never treated as an
-- operating company (enforced below via a check inside the ingestion
-- functions, since instrument_kind itself already excludes 'mutual_fund'
-- from ever being linked to company_profiles by FK-level convention).
--
-- Provider status at the time of this migration: identical to Phase 8 —
-- no stock-market credential exists in this environment. The fundamentals
-- provider boundary (schema, Edge Function, UI states) is implemented
-- against "twelve_data" (the same provider row Phase 8 already created in
-- market_data_provider_state), deployed in an intentionally inert
-- "not configured" state.

-- =======================================================================
-- 1. public.company_profiles
-- =======================================================================
-- A 1:1 extension of market_instruments for stock-kind instruments only,
-- carrying the extra provider-sourced profile fields market_instruments
-- itself doesn't need for non-company instruments (mutual funds).

create table if not exists public.company_profiles (
  instrument_id uuid primary key references public.market_instruments(id) on delete cascade,
  legal_name text null,
  country text null,
  sector text null,
  industry text null,
  fiscal_year_end text null,
  website text null,
  description text null,
  provider text not null,
  received_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint company_profiles_provider_valid check (provider in ('twelve_data')),
  constraint company_profiles_legal_name_length check (legal_name is null or char_length(legal_name) <= 200),
  constraint company_profiles_country_length check (country is null or char_length(country) <= 80),
  constraint company_profiles_sector_length check (sector is null or char_length(sector) <= 100),
  constraint company_profiles_industry_length check (industry is null or char_length(industry) <= 100),
  constraint company_profiles_fiscal_year_end_format check (fiscal_year_end is null or fiscal_year_end ~ '^\d{2}-\d{2}$'),
  constraint company_profiles_website_length check (website is null or char_length(website) <= 300),
  constraint company_profiles_description_length check (description is null or char_length(description) <= 4000)
);

comment on table public.company_profiles is
  'Provider-sourced company profile data — 1:1 with a stock-kind market_instruments row. '
  'Never user-editable; only a trusted service-role ingestion path writes here.';

drop trigger if exists set_company_profiles_updated_at on public.company_profiles;
create trigger set_company_profiles_updated_at
  before update on public.company_profiles
  for each row
  execute function public.set_updated_at();

-- Only a stock (an operating company) may have a profile — never a
-- mutual-fund scheme.
create or replace function public.validate_company_profile_instrument_kind()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_kind text;
begin
  select instrument_kind into v_kind from public.market_instruments where id = new.instrument_id;
  if v_kind is distinct from 'stock' then
    raise exception 'company_profiles.instrument_id must reference a stock-kind market_instruments row (got %)', v_kind
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists validate_company_profile_instrument_kind_trigger on public.company_profiles;
create trigger validate_company_profile_instrument_kind_trigger
  before insert or update of instrument_id on public.company_profiles
  for each row
  execute function public.validate_company_profile_instrument_kind();

-- =======================================================================
-- 2. public.company_financial_periods
-- =======================================================================
-- The reporting-period dimension (one row per company + period_type +
-- fiscal_period_end + statement_basis + provider). The actual reported
-- figures live in company_financial_metrics, keyed by period_id — keeping
-- "which period exists" and "what was reported for it" as separate
-- concerns lets a single metric be corrected without touching the period
-- identity row, and lets every metric carry its own independent
-- correction/audit trail (section 6 of the spec).

create table if not exists public.company_financial_periods (
  id uuid primary key default gen_random_uuid(),
  instrument_id uuid not null references public.market_instruments(id) on delete cascade,
  period_type text not null,
  fiscal_period_end date not null,
  fiscal_year integer not null,
  fiscal_quarter integer null,
  report_date date null,
  currency text not null,
  statement_basis text not null default 'consolidated',
  provider text not null,
  received_at timestamptz not null default now(),
  created_at timestamptz not null default now(),

  constraint company_financial_periods_period_type_valid check (period_type in ('annual', 'quarterly')),
  constraint company_financial_periods_quarter_valid check (
    (period_type = 'quarterly' and fiscal_quarter between 1 and 4) or
    (period_type = 'annual' and fiscal_quarter is null)
  ),
  constraint company_financial_periods_currency_format check (currency ~ '^[A-Z]{3}$'),
  constraint company_financial_periods_basis_valid check (statement_basis in ('consolidated', 'standalone')),
  constraint company_financial_periods_provider_valid check (provider in ('twelve_data')),
  constraint company_financial_periods_fiscal_year_range check (fiscal_year between 1990 and 2100)
);

comment on table public.company_financial_periods is
  'Reporting-period identity for a company''s financial statements — never revised in place once created; '
  'a provider correction to the period''s own report_date creates a superseding row via the same is_current/superseded_by pattern as market_prices.';

alter table public.company_financial_periods
  add column if not exists is_current boolean not null default true,
  add column if not exists superseded_by uuid null references public.company_financial_periods(id);

create unique index if not exists company_financial_periods_unique_current
  on public.company_financial_periods (instrument_id, period_type, fiscal_period_end, statement_basis, provider)
  where is_current = true;
create unique index if not exists company_financial_periods_superseded_by_unique
  on public.company_financial_periods (superseded_by)
  where superseded_by is not null;
create index if not exists company_financial_periods_instrument_idx
  on public.company_financial_periods (instrument_id, period_type, fiscal_period_end desc);

-- =======================================================================
-- 3. public.company_financial_metrics
-- =======================================================================
-- One provider observation per (period, metric) — the correction/audit
-- unit described in spec section 6, structurally identical to
-- market_prices: a later differing value supersedes the earlier one
-- in-place is never allowed, an idempotent re-ingest of the same value is
-- a no-op, and every historical observation stays queryable.

create table if not exists public.company_financial_metrics (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null references public.company_financial_periods(id) on delete cascade,
  statement_type text not null,
  metric_key text not null,
  value numeric(24, 4) not null,
  unit_scale text not null default 'unit',
  provider text not null,
  is_current boolean not null default true,
  superseded_by uuid null references public.company_financial_metrics(id),
  received_at timestamptz not null default now(),
  created_at timestamptz not null default now(),

  constraint company_financial_metrics_statement_type_valid check (
    statement_type in ('income_statement', 'balance_sheet', 'cash_flow', 'ratio')
  ),
  constraint company_financial_metrics_metric_key_valid check (
    metric_key in (
      -- income_statement
      'revenue', 'cost_of_revenue', 'gross_profit', 'operating_expenses', 'operating_income',
      'ebitda', 'interest_expense', 'profit_before_tax', 'tax_expense', 'net_income',
      'eps_basic', 'eps_diluted', 'shares_outstanding',
      -- balance_sheet
      'cash_and_equivalents', 'current_assets', 'total_assets', 'current_liabilities',
      'total_liabilities', 'short_term_debt', 'long_term_debt', 'total_debt',
      'shareholder_equity', 'retained_earnings',
      -- cash_flow
      'operating_cash_flow', 'capital_expenditure', 'investing_cash_flow', 'financing_cash_flow',
      'dividends_paid', 'debt_issuance', 'debt_repayment', 'free_cash_flow',
      -- ratio (provider-supplied only — never written by our own calculator)
      'pe_ratio', 'pb_ratio', 'ps_ratio', 'dividend_yield'
    )
  ),
  constraint company_financial_metrics_unit_scale_valid check (unit_scale in ('unit', 'thousand', 'million', 'crore', 'lakh')),
  constraint company_financial_metrics_provider_valid check (provider in ('twelve_data'))
);

comment on table public.company_financial_metrics is
  'One row per (period, metric) observation. Never overwritten in place — a correction supersedes the prior '
  'row via superseded_by, exactly mirroring market_prices. Only is_current=true rows drive the UI/ratios.';

create unique index if not exists company_financial_metrics_unique_current
  on public.company_financial_metrics (period_id, metric_key)
  where is_current = true;
create unique index if not exists company_financial_metrics_superseded_by_unique
  on public.company_financial_metrics (superseded_by)
  where superseded_by is not null;
create index if not exists company_financial_metrics_period_idx
  on public.company_financial_metrics (period_id) where is_current = true;

-- A metric's statement_type must agree with its metric_key's home
-- statement — enforced once, centrally, rather than duplicated in every
-- ingestion call site.
create or replace function public.validate_company_financial_metric_statement_type()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_expected text;
begin
  v_expected := case
    when new.metric_key in (
      'revenue', 'cost_of_revenue', 'gross_profit', 'operating_expenses', 'operating_income',
      'ebitda', 'interest_expense', 'profit_before_tax', 'tax_expense', 'net_income',
      'eps_basic', 'eps_diluted', 'shares_outstanding'
    ) then 'income_statement'
    when new.metric_key in (
      'cash_and_equivalents', 'current_assets', 'total_assets', 'current_liabilities',
      'total_liabilities', 'short_term_debt', 'long_term_debt', 'total_debt',
      'shareholder_equity', 'retained_earnings'
    ) then 'balance_sheet'
    when new.metric_key in (
      'operating_cash_flow', 'capital_expenditure', 'investing_cash_flow', 'financing_cash_flow',
      'dividends_paid', 'debt_issuance', 'debt_repayment', 'free_cash_flow'
    ) then 'cash_flow'
    when new.metric_key in ('pe_ratio', 'pb_ratio', 'ps_ratio', 'dividend_yield') then 'ratio'
    else null
  end;

  if new.statement_type is distinct from v_expected then
    raise exception 'metric_key % belongs to statement_type % (got %)', new.metric_key, v_expected, new.statement_type
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists validate_company_financial_metric_statement_type_trigger on public.company_financial_metrics;
create trigger validate_company_financial_metric_statement_type_trigger
  before insert or update of metric_key, statement_type on public.company_financial_metrics
  for each row
  execute function public.validate_company_financial_metric_statement_type();

-- =======================================================================
-- 4. public.watchlists
-- =======================================================================

create table if not exists public.watchlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text null,
  color text not null default 'slate',
  icon text not null default 'star',
  sort_order integer not null default 0,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint watchlists_name_length check (char_length(btrim(name)) between 1 and 120),
  constraint watchlists_description_length check (description is null or char_length(description) <= 1000),
  constraint watchlists_color_valid check (color in ('slate', 'red', 'orange', 'amber', 'green', 'teal', 'blue', 'purple', 'pink')),
  constraint watchlists_icon_valid check (icon in ('star', 'eye', 'flag', 'bookmark', 'target', 'trending-up', 'briefcase', 'lightbulb')),
  constraint watchlists_status_valid check (status in ('active', 'archived'))
);

drop trigger if exists set_watchlists_updated_at on public.watchlists;
create trigger set_watchlists_updated_at
  before update on public.watchlists
  for each row
  execute function public.set_updated_at();

create index if not exists watchlists_user_idx on public.watchlists (user_id, status, sort_order);

-- =======================================================================
-- 5. public.watchlist_items
-- =======================================================================

create table if not exists public.watchlist_items (
  id uuid primary key default gen_random_uuid(),
  watchlist_id uuid not null references public.watchlists(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  instrument_id uuid not null references public.market_instruments(id) on delete restrict,
  added_at timestamptz not null default now(),
  priority text not null default 'medium',
  target_review_date date null,
  research_status text not null default 'unreviewed',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint watchlist_items_priority_valid check (priority in ('low', 'medium', 'high')),
  constraint watchlist_items_research_status_valid check (
    research_status in ('unreviewed', 'researching', 'watching', 'thesis_ready', 'rejected', 'archived')
  )
);

comment on table public.watchlist_items is
  'user_id is denormalized from watchlists.user_id (set by trigger, never client-supplied) purely to let RLS '
  'policies check ownership without a subquery/join on every row — the same shape as ledger_entries.user_id.';

create unique index if not exists watchlist_items_unique_instrument
  on public.watchlist_items (watchlist_id, instrument_id);
create index if not exists watchlist_items_user_idx on public.watchlist_items (user_id, research_status);
create index if not exists watchlist_items_instrument_idx on public.watchlist_items (instrument_id);

drop trigger if exists set_watchlist_items_updated_at on public.watchlist_items;
create trigger set_watchlist_items_updated_at
  before update on public.watchlist_items
  for each row
  execute function public.set_updated_at();

create or replace function public.set_watchlist_item_user_id()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select user_id into new.user_id from public.watchlists where id = new.watchlist_id;
  if new.user_id is null then
    raise exception 'watchlist % does not exist' , new.watchlist_id using errcode = 'foreign_key_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists set_watchlist_item_user_id_trigger on public.watchlist_items;
create trigger set_watchlist_item_user_id_trigger
  before insert on public.watchlist_items
  for each row
  execute function public.set_watchlist_item_user_id();

-- =======================================================================
-- 6. public.research_notes
-- =======================================================================

create table if not exists public.research_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  instrument_id uuid not null references public.market_instruments(id) on delete restrict,
  title text not null,
  body text not null,
  note_type text not null default 'general',
  source_url text null,
  filing_id uuid null,
  observed_date date null,
  is_pinned boolean not null default false,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint research_notes_title_length check (char_length(btrim(title)) between 1 and 200),
  constraint research_notes_body_length check (char_length(body) <= 20000),
  constraint research_notes_type_valid check (
    note_type in ('general', 'financial_result', 'filing', 'management', 'risk', 'catalyst', 'valuation', 'decision')
  ),
  constraint research_notes_source_url_length check (source_url is null or char_length(source_url) <= 2048),
  constraint research_notes_source_url_https check (source_url is null or source_url like 'https://%')
);

comment on table public.research_notes is
  'body is stored and rendered as plain text only — never interpreted as HTML — so no sanitizer library is a '
  'security dependency: there is nothing here that can execute.';

create index if not exists research_notes_user_instrument_idx on public.research_notes (user_id, instrument_id, is_archived);

drop trigger if exists set_research_notes_updated_at on public.research_notes;
create trigger set_research_notes_updated_at
  before update on public.research_notes
  for each row
  execute function public.set_updated_at();

-- =======================================================================
-- 7. public.company_filings
-- =======================================================================
-- Manually user-added filing/source links — never server-fetched. See
-- spec section 10: a source link is not proof the content was parsed;
-- this table only ever stores what the user typed, and the app never
-- makes an outbound request to source_url on the user's behalf.

create table if not exists public.company_filings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  instrument_id uuid not null references public.market_instruments(id) on delete restrict,
  category text not null default 'other',
  title text not null,
  filing_date date null,
  source_domain text not null,
  source_url text not null,
  provider_document_id text null,
  is_verified boolean not null default false,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint company_filings_category_valid check (
    category in ('annual_report', 'quarterly_result', 'announcement', 'investor_presentation', 'credit_rating', 'regulatory_filing', 'other')
  ),
  constraint company_filings_title_length check (char_length(btrim(title)) between 1 and 200),
  constraint company_filings_source_domain_length check (char_length(source_domain) between 1 and 253),
  constraint company_filings_source_url_length check (char_length(source_url) between 1 and 2048),
  constraint company_filings_source_url_https check (source_url like 'https://%'),
  constraint company_filings_notes_length check (notes is null or char_length(notes) <= 2000)
);

create index if not exists company_filings_user_instrument_idx on public.company_filings (user_id, instrument_id);

drop trigger if exists set_company_filings_updated_at on public.company_filings;
create trigger set_company_filings_updated_at
  before update on public.company_filings
  for each row
  execute function public.set_updated_at();

alter table public.research_notes
  add constraint research_notes_filing_id_fkey foreign key (filing_id) references public.company_filings(id) on delete set null;

-- =======================================================================
-- 8. public.investment_theses + public.investment_thesis_versions
-- =======================================================================
-- investment_theses always reflects the CURRENT state; every insert/update
-- is automatically snapshotted into investment_thesis_versions by a
-- trigger — this happens regardless of whether the client went through a
-- dedicated RPC or a plain RLS-gated UPDATE, so "updating a thesis must
-- not overwrite prior versions silently" is enforced at the one place a
-- client can never bypass.

create table if not exists public.investment_theses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  instrument_id uuid not null references public.market_instruments(id) on delete restrict,
  title text not null,
  summary text null,
  investment_case text null,
  opportunities text null,
  risks text null,
  catalysts text null,
  invalidation_conditions text null,
  expected_review_date date null,
  time_horizon text not null default 'medium_term',
  confidence text not null default 'medium',
  status text not null default 'draft',
  current_version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint investment_theses_title_length check (char_length(btrim(title)) between 1 and 200),
  constraint investment_theses_time_horizon_valid check (time_horizon in ('short_term', 'medium_term', 'long_term')),
  constraint investment_theses_confidence_valid check (confidence in ('low', 'medium', 'high')),
  constraint investment_theses_status_valid check (status in ('draft', 'active', 'needs_review', 'invalidated', 'closed', 'archived'))
);

comment on table public.investment_theses is
  'confidence is a user-entered qualitative label only — never presented as a probability, and never used to '
  'compute or suggest a target price or trade instruction.';

create unique index if not exists investment_theses_unique_instrument
  on public.investment_theses (user_id, instrument_id)
  where status not in ('closed', 'archived');
create index if not exists investment_theses_user_idx on public.investment_theses (user_id, status);
create index if not exists investment_theses_review_idx on public.investment_theses (expected_review_date) where status = 'active';

create table if not exists public.investment_thesis_versions (
  id uuid primary key default gen_random_uuid(),
  thesis_id uuid not null references public.investment_theses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  version integer not null,
  title text not null,
  summary text null,
  investment_case text null,
  opportunities text null,
  risks text null,
  catalysts text null,
  invalidation_conditions text null,
  time_horizon text not null,
  confidence text not null,
  status text not null,
  created_at timestamptz not null default now()
);

comment on table public.investment_thesis_versions is
  'Immutable append-only snapshot history, written only by log_investment_thesis_version() — never directly '
  'insertable/updatable by a client (no grants below), and never deletable, so it stays a genuine audit trail.';

create unique index if not exists investment_thesis_versions_unique
  on public.investment_thesis_versions (thesis_id, version);
create index if not exists investment_thesis_versions_thesis_idx on public.investment_thesis_versions (thesis_id, version desc);

create or replace function public.log_investment_thesis_version()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    new.current_version := old.current_version + 1;
  else
    new.current_version := 1;
  end if;

  insert into public.investment_thesis_versions (
    thesis_id, user_id, version, title, summary, investment_case, opportunities,
    risks, catalysts, invalidation_conditions, time_horizon, confidence, status
  ) values (
    new.id, new.user_id, new.current_version, new.title, new.summary, new.investment_case, new.opportunities,
    new.risks, new.catalysts, new.invalidation_conditions, new.time_horizon, new.confidence, new.status
  );

  return new;
end;
$$;

drop trigger if exists log_investment_thesis_version_trigger on public.investment_theses;
create trigger log_investment_thesis_version_trigger
  before insert or update on public.investment_theses
  for each row
  execute function public.log_investment_thesis_version();

drop trigger if exists set_investment_theses_updated_at on public.investment_theses;
create trigger set_investment_theses_updated_at
  before update on public.investment_theses
  for each row
  execute function public.set_updated_at();

-- =======================================================================
-- 9. public.investment_ideas
-- =======================================================================

create table if not exists public.investment_ideas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  instrument_id uuid not null references public.market_instruments(id) on delete restrict,
  thesis_id uuid null references public.investment_theses(id) on delete set null,
  title text not null,
  status text not null default 'captured',
  priority text not null default 'medium',
  origin text null,
  rationale text null,
  risk_notes text null,
  next_review_date date null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint investment_ideas_title_length check (char_length(btrim(title)) between 1 and 200),
  constraint investment_ideas_status_valid check (
    status in ('captured', 'researching', 'watching', 'rejected', 'approved_for_manual_action', 'closed', 'archived')
  ),
  constraint investment_ideas_priority_valid check (priority in ('low', 'medium', 'high')),
  constraint investment_ideas_origin_length check (origin is null or char_length(origin) <= 200)
);

comment on table public.investment_ideas is
  'A personal research record only. status=approved_for_manual_action never places a trade or writes an '
  'investment_activities row — nothing in this table can reach the ledger or investment_holdings.';

create index if not exists investment_ideas_user_idx on public.investment_ideas (user_id, status);
create index if not exists investment_ideas_instrument_idx on public.investment_ideas (instrument_id);

drop trigger if exists set_investment_ideas_updated_at on public.investment_ideas;
create trigger set_investment_ideas_updated_at
  before update on public.investment_ideas
  for each row
  execute function public.set_updated_at();

-- =======================================================================
-- 10. public.research_review_events
-- =======================================================================
-- The single, unified private audit trail (spec point 20) — every
-- significant research mutation across watchlists/notes/theses/filings/
-- ideas inserts one row here, including automatic idea status-change
-- logging (the idea "decision log") via the trigger below. Insert-only
-- from the client's perspective: no update/delete grant is issued.

create table if not exists public.research_review_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  instrument_id uuid null references public.market_instruments(id) on delete set null,
  event_type text not null,
  related_table text null,
  related_id uuid null,
  summary text null,
  occurred_at timestamptz not null default now(),

  constraint research_review_events_type_valid check (
    event_type in (
      'watchlist_item_added', 'watchlist_item_removed', 'note_created', 'note_archived',
      'thesis_created', 'thesis_version_added', 'thesis_status_changed',
      'idea_created', 'idea_status_changed', 'filing_added', 'review_completed'
    )
  ),
  constraint research_review_events_summary_length check (summary is null or char_length(summary) <= 500)
);

create index if not exists research_review_events_user_idx on public.research_review_events (user_id, occurred_at desc);
create index if not exists research_review_events_instrument_idx on public.research_review_events (instrument_id, occurred_at desc);

create or replace function public.log_investment_idea_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.research_review_events (user_id, instrument_id, event_type, related_table, related_id, summary)
    values (new.user_id, new.instrument_id, 'idea_created', 'investment_ideas', new.id, 'Idea captured: ' || new.title);
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status then
    insert into public.research_review_events (user_id, instrument_id, event_type, related_table, related_id, summary)
    values (new.user_id, new.instrument_id, 'idea_status_changed', 'investment_ideas', new.id,
            old.status || ' -> ' || new.status);
  end if;
  return new;
end;
$$;

drop trigger if exists log_investment_idea_status_change_trigger on public.investment_ideas;
create trigger log_investment_idea_status_change_trigger
  after insert or update on public.investment_ideas
  for each row
  execute function public.log_investment_idea_status_change();

create or replace function public.log_investment_thesis_review_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.research_review_events (user_id, instrument_id, event_type, related_table, related_id, summary)
    values (new.user_id, new.instrument_id, 'thesis_created', 'investment_theses', new.id, 'Thesis created: ' || new.title);
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status then
    insert into public.research_review_events (user_id, instrument_id, event_type, related_table, related_id, summary)
    values (new.user_id, new.instrument_id, 'thesis_status_changed', 'investment_theses', new.id,
            old.status || ' -> ' || new.status);
  elsif tg_op = 'UPDATE' then
    insert into public.research_review_events (user_id, instrument_id, event_type, related_table, related_id, summary)
    values (new.user_id, new.instrument_id, 'thesis_version_added', 'investment_theses', new.id,
            'Version ' || new.current_version);
  end if;
  return new;
end;
$$;

drop trigger if exists log_investment_thesis_review_event_trigger on public.investment_theses;
create trigger log_investment_thesis_review_event_trigger
  after insert or update on public.investment_theses
  for each row
  execute function public.log_investment_thesis_review_event();

create or replace function public.log_watchlist_item_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.research_review_events (user_id, instrument_id, event_type, related_table, related_id)
    values (new.user_id, new.instrument_id, 'watchlist_item_added', 'watchlist_items', new.id);
  elsif tg_op = 'DELETE' then
    insert into public.research_review_events (user_id, instrument_id, event_type, related_table, related_id)
    values (old.user_id, old.instrument_id, 'watchlist_item_removed', 'watchlist_items', old.id);
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists log_watchlist_item_event_trigger on public.watchlist_items;
create trigger log_watchlist_item_event_trigger
  after insert or delete on public.watchlist_items
  for each row
  execute function public.log_watchlist_item_event();

create or replace function public.log_research_note_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.research_review_events (user_id, instrument_id, event_type, related_table, related_id, summary)
    values (new.user_id, new.instrument_id, 'note_created', 'research_notes', new.id, new.title);
  elsif tg_op = 'UPDATE' and new.is_archived = true and old.is_archived = false then
    insert into public.research_review_events (user_id, instrument_id, event_type, related_table, related_id, summary)
    values (new.user_id, new.instrument_id, 'note_archived', 'research_notes', new.id, new.title);
  end if;
  return new;
end;
$$;

drop trigger if exists log_research_note_event_trigger on public.research_notes;
create trigger log_research_note_event_trigger
  after insert or update on public.research_notes
  for each row
  execute function public.log_research_note_event();

create or replace function public.log_company_filing_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.research_review_events (user_id, instrument_id, event_type, related_table, related_id, summary)
  values (new.user_id, new.instrument_id, 'filing_added', 'company_filings', new.id, new.title);
  return new;
end;
$$;

drop trigger if exists log_company_filing_event_trigger on public.company_filings;
create trigger log_company_filing_event_trigger
  after insert on public.company_filings
  for each row
  execute function public.log_company_filing_event();

-- =======================================================================
-- 11. public.fundamentals_sync_runs
-- =======================================================================
-- Operational log for company-fundamentals refresh runs — same shape and
-- same deliberate zero-grant-to-authenticated design as
-- market_data_sync_runs (Phase 8): pure server-only observability data
-- that would leak which OTHER users are active via triggered_by_user_id
-- if it were even self-readable.

create table if not exists public.fundamentals_sync_runs (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  scope text not null,
  status text not null default 'running',
  started_at timestamptz not null default now(),
  completed_at timestamptz null,
  instruments_requested integer not null default 0,
  instruments_updated integer not null default 0,
  instruments_skipped integer not null default 0,
  error_code text null,
  rate_limit_remaining integer null,
  retry_count integer not null default 0,
  triggered_by_user_id uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),

  constraint fundamentals_sync_runs_provider_valid check (provider in ('twelve_data')),
  constraint fundamentals_sync_runs_scope_valid check (
    scope in ('profile', 'income_statement', 'balance_sheet', 'cash_flow', 'ratios', 'all')
  ),
  constraint fundamentals_sync_runs_status_valid check (status in ('running', 'success', 'partial', 'failed', 'skipped'))
);

create index if not exists fundamentals_sync_runs_provider_idx on public.fundamentals_sync_runs (provider, started_at desc);

-- =======================================================================
-- 12. Row-Level Security
-- =======================================================================

alter table public.company_profiles enable row level security;
alter table public.company_profiles force row level security;
alter table public.company_financial_periods enable row level security;
alter table public.company_financial_periods force row level security;
alter table public.company_financial_metrics enable row level security;
alter table public.company_financial_metrics force row level security;
alter table public.watchlists enable row level security;
alter table public.watchlists force row level security;
alter table public.watchlist_items enable row level security;
alter table public.watchlist_items force row level security;
alter table public.research_notes enable row level security;
alter table public.research_notes force row level security;
alter table public.company_filings enable row level security;
alter table public.company_filings force row level security;
alter table public.investment_theses enable row level security;
alter table public.investment_theses force row level security;
alter table public.investment_thesis_versions enable row level security;
alter table public.investment_thesis_versions force row level security;
alter table public.investment_ideas enable row level security;
alter table public.investment_ideas force row level security;
alter table public.research_review_events enable row level security;
alter table public.research_review_events force row level security;
alter table public.fundamentals_sync_runs enable row level security;
alter table public.fundamentals_sync_runs force row level security;

revoke all on public.company_profiles from public, anon, authenticated;
revoke all on public.company_financial_periods from public, anon, authenticated;
revoke all on public.company_financial_metrics from public, anon, authenticated;
revoke all on public.watchlists from public, anon, authenticated;
revoke all on public.watchlist_items from public, anon, authenticated;
revoke all on public.research_notes from public, anon, authenticated;
revoke all on public.company_filings from public, anon, authenticated;
revoke all on public.investment_theses from public, anon, authenticated;
revoke all on public.investment_thesis_versions from public, anon, authenticated;
revoke all on public.investment_ideas from public, anon, authenticated;
revoke all on public.research_review_events from public, anon, authenticated;
revoke all on public.fundamentals_sync_runs from public, anon, authenticated;

-- Shared provider data: globally readable (no user-ownership, no secret
-- config), never client-writable.
create policy company_profiles_select_all on public.company_profiles
  for select to authenticated using (true);
grant select on public.company_profiles to authenticated;

create policy company_financial_periods_select_all on public.company_financial_periods
  for select to authenticated using (true);
grant select on public.company_financial_periods to authenticated;

create policy company_financial_metrics_select_all on public.company_financial_metrics
  for select to authenticated using (true);
grant select on public.company_financial_metrics to authenticated;

-- Private research data: full CRUD for the owner, no cross-user access,
-- matching the categories/payees pattern exactly.
create policy watchlists_select_own on public.watchlists
  for select to authenticated using (user_id = (select auth.uid()));
create policy watchlists_insert_own on public.watchlists
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy watchlists_update_own on public.watchlists
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy watchlists_delete_own on public.watchlists
  for delete to authenticated using (user_id = (select auth.uid()));
grant select, insert, delete on public.watchlists to authenticated;
grant update (name, description, color, icon, sort_order, status) on public.watchlists to authenticated;

create policy watchlist_items_select_own on public.watchlist_items
  for select to authenticated using (user_id = (select auth.uid()));
create policy watchlist_items_insert_own on public.watchlist_items
  for insert to authenticated with check (
    watchlist_id in (select id from public.watchlists where user_id = (select auth.uid()))
  );
create policy watchlist_items_update_own on public.watchlist_items
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy watchlist_items_delete_own on public.watchlist_items
  for delete to authenticated using (user_id = (select auth.uid()));
grant select, insert, delete on public.watchlist_items to authenticated;
grant update (priority, target_review_date, research_status, sort_order) on public.watchlist_items to authenticated;

create policy research_notes_select_own on public.research_notes
  for select to authenticated using (user_id = (select auth.uid()));
create policy research_notes_insert_own on public.research_notes
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy research_notes_update_own on public.research_notes
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy research_notes_delete_own on public.research_notes
  for delete to authenticated using (user_id = (select auth.uid()));
grant select, insert, delete on public.research_notes to authenticated;
grant update (title, body, note_type, source_url, filing_id, observed_date, is_pinned, is_archived) on public.research_notes to authenticated;

create policy company_filings_select_own on public.company_filings
  for select to authenticated using (user_id = (select auth.uid()));
create policy company_filings_insert_own on public.company_filings
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy company_filings_update_own on public.company_filings
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy company_filings_delete_own on public.company_filings
  for delete to authenticated using (user_id = (select auth.uid()));
grant select, insert, delete on public.company_filings to authenticated;
grant update (category, title, filing_date, is_verified, notes) on public.company_filings to authenticated;

create policy investment_theses_select_own on public.investment_theses
  for select to authenticated using (user_id = (select auth.uid()));
create policy investment_theses_insert_own on public.investment_theses
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy investment_theses_update_own on public.investment_theses
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
grant select, insert on public.investment_theses to authenticated;
grant update (title, summary, investment_case, opportunities, risks, catalysts, invalidation_conditions,
              expected_review_date, time_horizon, confidence, status)
  on public.investment_theses to authenticated;
-- No delete grant: a thesis is closed/archived via status, never removed
-- (its version history must stay reachable).

create policy investment_thesis_versions_select_own on public.investment_thesis_versions
  for select to authenticated using (user_id = (select auth.uid()));
grant select on public.investment_thesis_versions to authenticated;
-- No insert/update/delete grant — written only by log_investment_thesis_version().

create policy investment_ideas_select_own on public.investment_ideas
  for select to authenticated using (user_id = (select auth.uid()));
create policy investment_ideas_insert_own on public.investment_ideas
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy investment_ideas_update_own on public.investment_ideas
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy investment_ideas_delete_own on public.investment_ideas
  for delete to authenticated using (user_id = (select auth.uid()));
grant select, insert, delete on public.investment_ideas to authenticated;
grant update (title, status, priority, origin, rationale, risk_notes, next_review_date, thesis_id) on public.investment_ideas to authenticated;

create policy research_review_events_select_own on public.research_review_events
  for select to authenticated using (user_id = (select auth.uid()));
grant select on public.research_review_events to authenticated;
-- No insert/update/delete grant — written only by the logging triggers above.

-- fundamentals_sync_runs: zero policies, zero grants for authenticated/anon
-- (matches market_data_sync_runs exactly — see that table's comment in
-- the Phase 8 migration for the reasoning).

-- Cross-instrument FK checks on the ingestion-side (a linked instrument
-- must be a stock, never a mutual fund) for the private tables that
-- reference market_instruments directly.
create or replace function public.validate_research_instrument_is_stock()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_kind text;
begin
  select instrument_kind into v_kind from public.market_instruments where id = new.instrument_id;
  if v_kind is distinct from 'stock' then
    raise exception '% requires a stock-kind market instrument (got %)', tg_table_name, v_kind
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists validate_research_notes_instrument_trigger on public.research_notes;
create trigger validate_research_notes_instrument_trigger
  before insert or update of instrument_id on public.research_notes
  for each row execute function public.validate_research_instrument_is_stock();

drop trigger if exists validate_company_filings_instrument_trigger on public.company_filings;
create trigger validate_company_filings_instrument_trigger
  before insert or update of instrument_id on public.company_filings
  for each row execute function public.validate_research_instrument_is_stock();

drop trigger if exists validate_investment_theses_instrument_trigger on public.investment_theses;
create trigger validate_investment_theses_instrument_trigger
  before insert or update of instrument_id on public.investment_theses
  for each row execute function public.validate_research_instrument_is_stock();

drop trigger if exists validate_investment_ideas_instrument_trigger on public.investment_ideas;
create trigger validate_investment_ideas_instrument_trigger
  before insert or update of instrument_id on public.investment_ideas
  for each row execute function public.validate_research_instrument_is_stock();

-- =======================================================================
-- 13. Ingestion functions (service-role only)
-- =======================================================================

create or replace function public.ingest_company_profile(
  p_instrument_id uuid,
  p_provider text,
  p_legal_name text default null,
  p_country text default null,
  p_sector text default null,
  p_industry text default null,
  p_fiscal_year_end text default null,
  p_website text default null,
  p_description text default null
)
returns public.company_profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.company_profiles;
begin
  insert into public.company_profiles (
    instrument_id, provider, legal_name, country, sector, industry, fiscal_year_end, website, description, received_at
  ) values (
    p_instrument_id, p_provider, p_legal_name, p_country, p_sector, p_industry, p_fiscal_year_end, p_website, p_description, now()
  )
  on conflict (instrument_id) do update set
    provider = excluded.provider,
    legal_name = excluded.legal_name,
    country = excluded.country,
    sector = excluded.sector,
    industry = excluded.industry,
    fiscal_year_end = excluded.fiscal_year_end,
    website = excluded.website,
    description = excluded.description,
    received_at = now()
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.ingest_company_profile(uuid, text, text, text, text, text, text, text, text) from public;
grant execute on function public.ingest_company_profile(uuid, text, text, text, text, text, text, text, text) to service_role;

-- Finds or creates the period identity row (idempotent on the unique
-- current-row index) and returns its id.
create or replace function public.ensure_company_financial_period(
  p_instrument_id uuid,
  p_period_type text,
  p_fiscal_period_end date,
  p_fiscal_year integer,
  p_fiscal_quarter integer,
  p_report_date date,
  p_currency text,
  p_statement_basis text,
  p_provider text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing public.company_financial_periods;
  v_new_id uuid;
begin
  select * into v_existing
  from public.company_financial_periods
  where instrument_id = p_instrument_id
    and period_type = p_period_type
    and fiscal_period_end = p_fiscal_period_end
    and statement_basis = p_statement_basis
    and provider = p_provider
    and is_current = true
  for update;

  if v_existing.id is not null and v_existing.report_date is not distinct from p_report_date then
    return v_existing.id;
  end if;

  if v_existing.id is not null then
    update public.company_financial_periods set is_current = false where id = v_existing.id;
  end if;

  insert into public.company_financial_periods (
    instrument_id, period_type, fiscal_period_end, fiscal_year, fiscal_quarter,
    report_date, currency, statement_basis, provider
  ) values (
    p_instrument_id, p_period_type, p_fiscal_period_end, p_fiscal_year, p_fiscal_quarter,
    p_report_date, p_currency, p_statement_basis, p_provider
  )
  returning id into v_new_id;

  if v_existing.id is not null then
    update public.company_financial_periods set superseded_by = v_new_id where id = v_existing.id;
  end if;

  return v_new_id;
end;
$$;

revoke all on function public.ensure_company_financial_period(uuid, text, date, integer, integer, date, text, text, text) from public;
grant execute on function public.ensure_company_financial_period(uuid, text, date, integer, integer, date, text, text, text) to service_role;

-- Atomic, auditable single-metric correction/upsert — the same
-- read-existing/supersede-old/insert-new shape as
-- ingest_market_price_observation (Phase 8).
create or replace function public.ingest_company_financial_metric(
  p_period_id uuid,
  p_statement_type text,
  p_metric_key text,
  p_value numeric,
  p_unit_scale text default 'unit',
  p_provider text default 'twelve_data'
)
returns public.company_financial_metrics
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing public.company_financial_metrics;
  v_inserted public.company_financial_metrics;
begin
  select * into v_existing
  from public.company_financial_metrics
  where period_id = p_period_id and metric_key = p_metric_key and is_current = true
  for update;

  if v_existing.id is not null and v_existing.value = p_value and v_existing.unit_scale = p_unit_scale then
    return v_existing;
  end if;

  if v_existing.id is not null then
    update public.company_financial_metrics set is_current = false where id = v_existing.id;
  end if;

  insert into public.company_financial_metrics (
    period_id, statement_type, metric_key, value, unit_scale, provider, is_current
  ) values (
    p_period_id, p_statement_type, p_metric_key, p_value, p_unit_scale, p_provider, true
  )
  returning * into v_inserted;

  if v_existing.id is not null then
    update public.company_financial_metrics set superseded_by = v_inserted.id where id = v_existing.id;
  end if;

  return v_inserted;
end;
$$;

revoke all on function public.ingest_company_financial_metric(uuid, text, text, numeric, text, text) from public;
grant execute on function public.ingest_company_financial_metric(uuid, text, text, numeric, text, text) to service_role;

-- Bulk counterpart, mirroring ingest_market_price_observations_batch —
-- lets the Edge Function ingest one company's whole statement (dozens of
-- metrics across several periods) in one round trip.
create or replace function public.ingest_company_financial_metrics_batch(
  p_rows jsonb
)
returns table (updated_count integer, skipped_count integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  v_updated integer := 0;
  v_skipped integer := 0;
begin
  for r in
    select *
    from jsonb_to_recordset(p_rows) as x(
      period_id uuid, statement_type text, metric_key text, value numeric, unit_scale text, provider text
    )
  loop
    begin
      perform public.ingest_company_financial_metric(
        r.period_id, r.statement_type, r.metric_key, r.value,
        coalesce(r.unit_scale, 'unit'), coalesce(r.provider, 'twelve_data')
      );
      v_updated := v_updated + 1;
    exception when others then
      v_skipped := v_skipped + 1;
    end;
  end loop;

  updated_count := v_updated;
  skipped_count := v_skipped;
  return next;
end;
$$;

revoke all on function public.ingest_company_financial_metrics_batch(jsonb) from public;
grant execute on function public.ingest_company_financial_metrics_batch(jsonb) to service_role;

-- =======================================================================
-- 14. Refresh orchestration
-- =======================================================================

create or replace function public.run_fundamentals_refresh(p_instrument_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_configured boolean;
begin
  select is_configured into v_configured from public.market_data_provider_state where provider = 'twelve_data';

  if v_configured is not true or p_instrument_ids is null or array_length(p_instrument_ids, 1) is null then
    insert into public.fundamentals_sync_runs (provider, scope, status, error_code, instruments_requested, completed_at)
    values (
      'twelve_data', 'all', 'skipped',
      case when v_configured is not true then 'provider_not_configured' else 'no_instruments' end,
      coalesce(array_length(p_instrument_ids, 1), 0), now()
    );
    return;
  end if;

  perform public.invoke_market_data_function(
    'company-fundamentals-refresh',
    jsonb_build_object('instrument_ids', to_jsonb(p_instrument_ids))
  );
end;
$$;

revoke all on function public.run_fundamentals_refresh(uuid[]) from public;
grant execute on function public.run_fundamentals_refresh(uuid[]) to service_role;

-- Gathers every distinct stock instrument currently linked by ANY user
-- (via an owned holding or a watchlist item), deduplicated once across
-- all users so a company watched by 500 users is still only refreshed
-- once per run — never a per-user quota multiplier.
create or replace function public.process_company_fundamentals_refresh_all()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ids uuid[];
begin
  select array_agg(distinct mi.id) into v_ids
  from public.market_instruments mi
  where mi.instrument_kind = 'stock' and mi.is_active = true
    and (
      exists (select 1 from public.investment_assets a where a.market_instrument_id = mi.id)
      or exists (select 1 from public.watchlist_items wi where wi.instrument_id = mi.id)
    );

  perform public.run_fundamentals_refresh(v_ids);
end;
$$;

revoke all on function public.process_company_fundamentals_refresh_all() from public;
grant execute on function public.process_company_fundamentals_refresh_all() to service_role;

-- Self-scoped, cooldown-limited manual refresh — identical cooldown
-- mechanism to run_market_data_refresh_self (reuses
-- fundamentals_sync_runs.triggered_by_user_id as its own source of truth,
-- no separate cooldown table).
create or replace function public.run_fundamentals_refresh_self()
returns table (queued boolean, retry_after_seconds integer, instruments_requested integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_last_run timestamptz;
  v_cooldown_seconds constant integer := 900;
  v_ids uuid[];
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select max(started_at) into v_last_run
  from public.fundamentals_sync_runs
  where triggered_by_user_id = v_user_id;

  if v_last_run is not null and v_last_run > now() - make_interval(secs => v_cooldown_seconds) then
    queued := false;
    retry_after_seconds := v_cooldown_seconds - floor(extract(epoch from (now() - v_last_run)))::integer;
    instruments_requested := 0;
    return next;
    return;
  end if;

  select array_agg(distinct mi.id) into v_ids
  from public.market_instruments mi
  where mi.instrument_kind = 'stock' and mi.is_active = true
    and (
      exists (
        select 1 from public.investment_assets a
        join public.investment_holdings h on h.investment_asset_id = a.id
        where a.market_instrument_id = mi.id and a.user_id = v_user_id and h.status = 'active'
      )
      or exists (
        select 1 from public.watchlist_items wi where wi.instrument_id = mi.id and wi.user_id = v_user_id
      )
    );

  insert into public.fundamentals_sync_runs (provider, scope, status, instruments_requested, triggered_by_user_id)
  values ('twelve_data', 'all', 'running', coalesce(array_length(v_ids, 1), 0), v_user_id);

  perform public.run_fundamentals_refresh(v_ids);

  queued := coalesce(array_length(v_ids, 1), 0) > 0;
  retry_after_seconds := v_cooldown_seconds;
  instruments_requested := coalesce(array_length(v_ids, 1), 0);
  return next;
end;
$$;

revoke all on function public.run_fundamentals_refresh_self() from public;
grant execute on function public.run_fundamentals_refresh_self() to authenticated;

-- Bulk-transitions overdue active theses to needs_review — each such
-- update is itself auto-versioned by log_investment_thesis_version(),
-- so the transition becomes a genuine, auditable part of the thesis's
-- own history rather than a cosmetic read-time label.
create or replace function public.mark_overdue_theses_needs_review()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  with updated as (
    update public.investment_theses
    set status = 'needs_review'
    where status = 'active' and expected_review_date is not null and expected_review_date < current_date
    returning id
  )
  select count(*) into v_count from updated;

  return v_count;
end;
$$;

revoke all on function public.mark_overdue_theses_needs_review() from public;
grant execute on function public.mark_overdue_theses_needs_review() to service_role;

-- Read-only, RLS-scoped reminder computation — deliberately never
-- persisted (spec: "do not create duplicate reminder rows merely for
-- presentation"). security invoker so RLS naturally restricts every
-- underlying query to the caller's own rows.
create or replace function public.research_review_reminders()
returns table (
  reminder_type text,
  instrument_id uuid,
  related_id uuid,
  title text,
  due_date date
)
language sql
security invoker
set search_path = ''
stable
as $$
  select 'thesis_overdue'::text, t.instrument_id, t.id, t.title, t.expected_review_date
  from public.investment_theses t
  where t.status in ('active', 'needs_review') and t.expected_review_date < current_date

  union all

  select 'thesis_due_soon'::text, t.instrument_id, t.id, t.title, t.expected_review_date
  from public.investment_theses t
  where t.status = 'active' and t.expected_review_date >= current_date
    and t.expected_review_date <= current_date + interval '7 days'

  union all

  select 'watchlist_review_due'::text, w.instrument_id, w.id, mi.name, w.target_review_date
  from public.watchlist_items w
  join public.market_instruments mi on mi.id = w.instrument_id
  where w.target_review_date is not null and w.target_review_date <= current_date
    and w.research_status not in ('rejected', 'archived');
$$;

revoke all on function public.research_review_reminders() from public;
grant execute on function public.research_review_reminders() to authenticated;

-- =======================================================================
-- 15. Cron registration (5 existing jobs untouched)
-- =======================================================================

select cron.schedule('penra-company-fundamentals-refresh', '0 11 * * *', $$select public.process_company_fundamentals_refresh_all();$$);
select cron.schedule('penra-company-fundamentals-retry', '0 2 * * *', $$select public.process_company_fundamentals_refresh_all();$$);
select cron.schedule('penra-research-review-reminders', '15 18 * * *', $$select public.mark_overdue_theses_needs_review();$$);
