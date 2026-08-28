-- =======================================================================
-- Phase 13 — Indian tax-planning workspace: profile, manual tax inputs
-- (income classification, deductions, TDS/TCS/payments, AIS/26AS
-- reconciliation), and versioned report snapshots.
--
-- Architecture summary:
--   * Tax RULES themselves (slabs, rebates, cess, capital-gains rates,
--     holding-period thresholds) are NOT stored here at all — they live
--     as immutable, source-controlled TypeScript modules under
--     src/lib/tax/rules/ (see registry.ts's own module comment for why:
--     a rule set ships as part of an application release, reviewed like
--     any other code change, so no browser role can ever forge or alter
--     a shared tax rule the way a mutable database row could be).
--   * The tax-lot FIFO matching engine, capital-gains classification, and
--     old/new regime comparison are ALSO not implemented in SQL — they
--     are pure, deterministic TypeScript (src/lib/tax/engine/*.ts),
--     exactly mirroring this codebase's established payoff.ts/
--     forecast.ts precedent from Phase 12: a computation with nothing to
--     write to cannot accidentally mutate the ledger or investment
--     history, and it stays exhaustively unit-testable. This migration
--     only ever stores: (a) the user's own manual tax inputs/evidence,
--     and (b) a finalized snapshot's already-computed JSON result.
--   * A finalized public.tax_report_snapshots row is immutable — see the
--     prevent_finalized_snapshot_mutation trigger. Regenerating a report
--     for the same financial year never overwrites a finalized snapshot;
--     it inserts a new row and, only via the same transaction that
--     creates the new snapshot, flips the prior one's status to
--     'superseded' (see create_tax_report_snapshot). The prior snapshot
--     is never deleted.
--   * No table or function in this migration ever touches
--     ledger_transactions, ledger_entries, investment_activities, or
--     investment_holdings — every tax input here is either a plain
--     user-entered fact or a read-only reference (foreign key) to an
--     existing record for provenance. See section 9's explicit comment
--     on why tax_income_adjustments/tax_payments only ever LINK to a
--     ledger transaction, never repost or duplicate one.
-- =======================================================================

-- =======================================================================
-- 1. public.tax_profiles — one row per user.
-- =======================================================================

create table if not exists public.tax_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  taxpayer_type text not null default 'individual',
  residential_status text not null default 'resident',
  has_business_or_professional_income boolean not null default false,
  has_salary_or_pension_income boolean not null default true,
  default_regime_preference text null,
  age_band text null,
  -- Only the last 4 characters of a PAN, e.g. "1234F" is never stored —
  -- this column accepts at most 4 alphanumeric characters and nothing
  -- resembling a full PAN (10 chars) can ever pass the check constraint.
  -- Aadhaar is never collected anywhere in this schema.
  masked_pan_label text null,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint tax_profiles_user_unique unique (user_id),
  constraint tax_profiles_taxpayer_type_valid check (taxpayer_type in ('individual')),
  constraint tax_profiles_residential_status_valid check (
    residential_status in ('resident', 'non_resident', 'resident_not_ordinarily_resident')
  ),
  constraint tax_profiles_regime_preference_valid check (
    default_regime_preference is null or default_regime_preference in ('old', 'new')
  ),
  constraint tax_profiles_age_band_valid check (
    age_band is null or age_band in ('below_60', '60_to_80', 'above_80')
  ),
  constraint tax_profiles_masked_pan_format check (
    masked_pan_label is null or masked_pan_label ~ '^[A-Z0-9]{1,4}$'
  ),
  constraint tax_profiles_notes_length check (notes is null or char_length(notes) <= 2000)
);

comment on table public.tax_profiles is
  'One private tax profile per user. Never stores Aadhaar; masked_pan_label accepts at most the last 4 characters of a PAN, never a full PAN. Drives which calculations src/lib/tax/rules/registry.ts''s SUPPORTED_TAXPAYER_SCOPE will attempt versus mark unavailable — see get_tax_calculation_scope.';

drop trigger if exists set_tax_profiles_updated_at on public.tax_profiles;
create trigger set_tax_profiles_updated_at
  before update on public.tax_profiles
  for each row
  execute function public.set_updated_at();

-- =======================================================================
-- 2. public.tax_income_adjustments — manual/mapped income classification.
-- =======================================================================

create table if not exists public.tax_income_adjustments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  financial_year_id text not null,
  category text not null,
  gross_amount numeric(20, 4) not null,
  tds_amount numeric(20, 4) not null default 0,
  currency text not null default 'INR',
  is_exempt_candidate boolean not null default false,
  source_type text not null default 'manual',
  -- Provenance — at most one of these is set, matching source_type.
  source_ledger_transaction_id uuid null references public.ledger_transactions (id) on delete set null,
  source_investment_activity_id uuid null references public.investment_activities (id) on delete set null,
  evidence_label text null,
  notes text null,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint tax_income_adjustments_fy_format check (financial_year_id ~ '^\d{4}-\d{2}$'),
  constraint tax_income_adjustments_category_valid check (
    category in (
      'salary', 'savings_interest', 'fd_interest', 'rd_interest', 'ppf_interest',
      'dividend', 'refund_interest', 'other_taxable_interest', 'other_income'
    )
  ),
  constraint tax_income_adjustments_gross_nonnegative check (gross_amount >= 0),
  constraint tax_income_adjustments_tds_nonnegative check (tds_amount >= 0 and tds_amount <= gross_amount),
  constraint tax_income_adjustments_currency_format check (currency ~ '^[A-Z]{3}$'),
  constraint tax_income_adjustments_source_type_valid check (
    source_type in ('manual', 'ledger_transaction', 'investment_activity')
  ),
  constraint tax_income_adjustments_source_shape check (
    (source_type = 'manual' and source_ledger_transaction_id is null and source_investment_activity_id is null)
    or (source_type = 'ledger_transaction' and source_ledger_transaction_id is not null and source_investment_activity_id is null)
    or (source_type = 'investment_activity' and source_investment_activity_id is not null and source_ledger_transaction_id is null)
  ),
  constraint tax_income_adjustments_evidence_length check (evidence_label is null or char_length(evidence_label) <= 300),
  constraint tax_income_adjustments_notes_length check (notes is null or char_length(notes) <= 2000),
  constraint tax_income_adjustments_status_valid check (status in ('draft', 'confirmed'))
);

comment on table public.tax_income_adjustments is
  'One row per classified income item for one financial year — gross_amount and tds_amount are kept as distinct columns (never a single net figure) so a dividend/interest report can always show gross, withheld, and net separately, per this phase''s explicit "never use net bank credit as gross taxable income" rule. A ledger transaction or investment activity is only ever LINKED here for provenance, never reposted.';

create unique index if not exists tax_income_adjustments_ledger_txn_unique
  on public.tax_income_adjustments (user_id, source_ledger_transaction_id)
  where source_ledger_transaction_id is not null;
create unique index if not exists tax_income_adjustments_investment_activity_unique
  on public.tax_income_adjustments (user_id, source_investment_activity_id)
  where source_investment_activity_id is not null;
create index if not exists tax_income_adjustments_user_fy_idx
  on public.tax_income_adjustments (user_id, financial_year_id, category);

drop trigger if exists set_tax_income_adjustments_updated_at on public.tax_income_adjustments;
create trigger set_tax_income_adjustments_updated_at
  before update on public.tax_income_adjustments
  for each row
  execute function public.set_updated_at();

-- =======================================================================
-- 3. public.tax_deductions
-- =======================================================================

create table if not exists public.tax_deductions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  financial_year_id text not null,
  section text not null,
  claimed_amount numeric(20, 4) not null,
  evidence_label text null,
  masked_reference text null,
  source_url text null,
  notes text null,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint tax_deductions_fy_format check (financial_year_id ~ '^\d{4}-\d{2}$'),
  constraint tax_deductions_section_length check (char_length(btrim(section)) between 1 and 40),
  constraint tax_deductions_claimed_positive check (claimed_amount > 0),
  constraint tax_deductions_evidence_length check (evidence_label is null or char_length(evidence_label) <= 300),
  constraint tax_deductions_masked_reference_length check (masked_reference is null or char_length(masked_reference) <= 60),
  constraint tax_deductions_source_url_length check (source_url is null or char_length(source_url) <= 500),
  constraint tax_deductions_notes_length check (notes is null or char_length(notes) <= 2000),
  constraint tax_deductions_status_valid check (status in ('draft', 'confirmed'))
);

comment on table public.tax_deductions is
  'User-entered deduction evidence for one financial year. claimed_amount is always the user''s own entered figure; whether it is eligible/capped under a given regime is decided at calculation time by src/lib/tax/engine against the rule set''s deductionCatalog — never adjudicated or capped here.';

create index if not exists tax_deductions_user_fy_idx
  on public.tax_deductions (user_id, financial_year_id, section);

drop trigger if exists set_tax_deductions_updated_at on public.tax_deductions;
create trigger set_tax_deductions_updated_at
  before update on public.tax_deductions
  for each row
  execute function public.set_updated_at();

-- =======================================================================
-- 4. public.tax_withholdings — TDS/TCS evidence.
-- =======================================================================

create table if not exists public.tax_withholdings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  financial_year_id text not null,
  withholding_type text not null,
  deductor_name text not null,
  masked_tan text null,
  income_category text null,
  gross_amount numeric(20, 4) not null,
  tax_withheld numeric(20, 4) not null,
  withheld_on date not null,
  reference_label text null,
  evidence_source text null,
  reconciliation_status text not null default 'unreviewed',
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint tax_withholdings_fy_format check (financial_year_id ~ '^\d{4}-\d{2}$'),
  constraint tax_withholdings_type_valid check (
    withholding_type in ('salary_tds', 'interest_tds', 'dividend_tds', 'other_tds', 'tcs')
  ),
  constraint tax_withholdings_deductor_length check (char_length(btrim(deductor_name)) between 1 and 200),
  constraint tax_withholdings_masked_tan_format check (masked_tan is null or masked_tan ~ '^[A-Z0-9]{1,4}$'),
  constraint tax_withholdings_gross_nonnegative check (gross_amount >= 0),
  constraint tax_withholdings_withheld_nonnegative check (tax_withheld >= 0),
  constraint tax_withholdings_reference_length check (reference_label is null or char_length(reference_label) <= 100),
  constraint tax_withholdings_evidence_source_length check (evidence_source is null or char_length(evidence_source) <= 300),
  constraint tax_withholdings_notes_length check (notes is null or char_length(notes) <= 2000),
  constraint tax_withholdings_reconciliation_status_valid check (
    reconciliation_status in ('unreviewed', 'matched', 'difference', 'user_confirmed')
  )
);

comment on table public.tax_withholdings is
  'User-entered TDS/TCS evidence, distinct from tax_income_adjustments.tds_amount — this table is the reconciliation-grade record (deductor, TAN, challan-style reference); the income-adjustment column is the summary figure used directly in a calculation. masked_tan accepts at most 4 characters, never a full TAN.';

create index if not exists tax_withholdings_user_fy_idx
  on public.tax_withholdings (user_id, financial_year_id, withholding_type);

drop trigger if exists set_tax_withholdings_updated_at on public.tax_withholdings;
create trigger set_tax_withholdings_updated_at
  before update on public.tax_withholdings
  for each row
  execute function public.set_updated_at();

-- =======================================================================
-- 5. public.tax_payments — advance tax / self-assessment tax / refunds.
-- =======================================================================

create table if not exists public.tax_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  financial_year_id text not null,
  payment_type text not null,
  amount numeric(20, 4) not null,
  paid_on date not null,
  challan_reference text null,
  -- An existing real ledger transaction this payment/refund corresponds
  -- to, linked for provenance only — never reposted (see this
  -- migration's own header comment). Unique per user so the same
  -- transaction can never be linked to two tax_payments rows.
  related_transaction_id uuid null references public.ledger_transactions (id) on delete set null,
  notes text null,
  created_at timestamptz not null default now(),

  constraint tax_payments_fy_format check (financial_year_id ~ '^\d{4}-\d{2}$'),
  constraint tax_payments_type_valid check (
    payment_type in ('advance_tax', 'self_assessment_tax', 'refund')
  ),
  constraint tax_payments_amount_positive check (amount > 0),
  constraint tax_payments_challan_length check (challan_reference is null or char_length(challan_reference) <= 100),
  constraint tax_payments_notes_length check (notes is null or char_length(notes) <= 2000)
);

comment on table public.tax_payments is
  'User-entered advance-tax / self-assessment-tax payments and refunds received, for one financial year. related_transaction_id links to (never reposts) an existing ledger transaction the user already recorded for the same real money movement.';

create unique index if not exists tax_payments_related_transaction_unique
  on public.tax_payments (user_id, related_transaction_id)
  where related_transaction_id is not null;
create index if not exists tax_payments_user_fy_idx
  on public.tax_payments (user_id, financial_year_id, payment_type);

-- =======================================================================
-- 6. public.tax_asset_classifications — user-confirmed capital-asset tax
--    treatment per investment_assets row (never inferred).
-- =======================================================================

create table if not exists public.tax_asset_classifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  investment_asset_id uuid not null references public.investment_assets (id) on delete cascade,
  asset_class text not null,
  unsupported_reason text null,
  confirmed_at timestamptz not null default now(),
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint tax_asset_classifications_asset_unique unique (user_id, investment_asset_id),
  constraint tax_asset_classifications_asset_class_valid check (
    asset_class in ('listed_equity', 'equity_oriented_mutual_fund', 'unsupported')
  ),
  constraint tax_asset_classifications_unsupported_reason_shape check (
    (asset_class = 'unsupported' and unsupported_reason is not null)
    or (asset_class <> 'unsupported' and unsupported_reason is null)
  ),
  constraint tax_asset_classifications_notes_length check (notes is null or char_length(notes) <= 1000)
);

comment on table public.tax_asset_classifications is
  'The user''s own confirmation of how one investment_assets row should be treated for capital-gains tax — src/lib/tax/engine never infers "listed equity" vs "debt fund" vs an unsupported corporate-action case from asset_kind alone. A row absent here means "not yet classified," which the capital-gains report must show as excluded/needing review, never silently defaulted to listed_equity.';

drop trigger if exists set_tax_asset_classifications_updated_at on public.tax_asset_classifications;
create trigger set_tax_asset_classifications_updated_at
  before update on public.tax_asset_classifications
  for each row
  execute function public.set_updated_at();

-- =======================================================================
-- 7. public.tax_reconciliation_items — manual AIS/Form 26AS reconciliation.
-- =======================================================================

create table if not exists public.tax_reconciliation_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  financial_year_id text not null,
  source text not null,
  income_category text not null,
  reported_amount numeric(20, 4) null,
  processed_amount numeric(20, 4) null,
  penra_amount numeric(20, 4) null,
  accepted_amount numeric(20, 4) null,
  status text not null default 'unreviewed',
  explanation text null,
  evidence_source text null,
  evidence_date date null,
  last_reviewed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint tax_reconciliation_items_fy_format check (financial_year_id ~ '^\d{4}-\d{2}$'),
  constraint tax_reconciliation_items_source_valid check (source in ('ais', 'form_26as')),
  constraint tax_reconciliation_items_category_length check (char_length(btrim(income_category)) between 1 and 100),
  constraint tax_reconciliation_items_status_valid check (
    status in (
      'unreviewed', 'matched', 'difference', 'missing_in_penra',
      'missing_in_statement', 'user_confirmed', 'not_applicable'
    )
  ),
  constraint tax_reconciliation_items_explanation_length check (explanation is null or char_length(explanation) <= 2000),
  constraint tax_reconciliation_items_evidence_source_length check (evidence_source is null or char_length(evidence_source) <= 300)
);

comment on table public.tax_reconciliation_items is
  'One manually-entered AIS/TIS or Form 26AS line the user is reconciling against PENRA''s own computed figure. reported_amount/processed_amount (from the statement), penra_amount (PENRA''s derived figure), and accepted_amount (what the user has decided is correct) are kept as four separate columns — never collapsed into one, since disagreement between them is exactly what this table exists to preserve, not erase.';

create index if not exists tax_reconciliation_items_user_fy_idx
  on public.tax_reconciliation_items (user_id, financial_year_id, source);

drop trigger if exists set_tax_reconciliation_items_updated_at on public.tax_reconciliation_items;
create trigger set_tax_reconciliation_items_updated_at
  before update on public.tax_reconciliation_items
  for each row
  execute function public.set_updated_at();

-- =======================================================================
-- 8. public.tax_report_snapshots — versioned, immutable-once-finalized
--    report snapshots. snapshot_data holds the full already-computed
--    result produced by src/lib/tax/engine (income summary, capital
--    gains lines, deductions, withholdings, reconciliation differences,
--    regime comparison) as one auditable JSON document — see this
--    migration's header comment for why the calculation itself is never
--    reimplemented in SQL.
-- =======================================================================

create table if not exists public.tax_report_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  financial_year_id text not null,
  assessment_year_id text not null,
  rule_set_version text not null,
  status text not null default 'draft',
  completeness_status text not null default 'partial',
  snapshot_data jsonb not null,
  warnings jsonb not null default '[]'::jsonb,
  supersedes_snapshot_id uuid null references public.tax_report_snapshots (id) on delete set null,
  superseded_by uuid null references public.tax_report_snapshots (id) on delete set null,
  generated_at timestamptz not null default now(),
  finalized_at timestamptz null,
  created_at timestamptz not null default now(),

  constraint tax_report_snapshots_fy_format check (financial_year_id ~ '^\d{4}-\d{2}$'),
  constraint tax_report_snapshots_ay_format check (assessment_year_id ~ '^\d{4}-\d{2}$'),
  constraint tax_report_snapshots_status_valid check (
    status in ('draft', 'needs_review', 'ready', 'finalized', 'superseded')
  ),
  constraint tax_report_snapshots_completeness_valid check (
    completeness_status in ('complete', 'partial', 'unavailable', 'stale')
  ),
  constraint tax_report_snapshots_finalized_at_shape check (
    (status = 'finalized' and finalized_at is not null)
    or (status <> 'finalized' and finalized_at is null)
    or status = 'superseded'
  )
);

comment on table public.tax_report_snapshots is
  'A generated (draft) or finalized report for one financial year. Once status=''finalized'', the row is immutable except for the single recognised transition to ''superseded'' when a later snapshot replaces it (see prevent_finalized_snapshot_mutation and create_tax_report_snapshot) — the prior finalized snapshot is never deleted or edited, only marked superseded, so a historical report can never silently change under a newer rule set or newer source data.';

create index if not exists tax_report_snapshots_user_fy_idx
  on public.tax_report_snapshots (user_id, financial_year_id, created_at desc);

-- Immutability enforcement: once a row is 'finalized', block every update
-- except the exact supersede transition (finalized -> superseded, with
-- superseded_by being newly set and nothing else about the row changing).
create or replace function public.prevent_finalized_snapshot_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status <> 'finalized' then
    return new;
  end if;

  if new.status = 'superseded'
     and new.superseded_by is not null
     and old.superseded_by is null
     and new.financial_year_id = old.financial_year_id
     and new.assessment_year_id = old.assessment_year_id
     and new.rule_set_version = old.rule_set_version
     and new.snapshot_data = old.snapshot_data
     and new.finalized_at = old.finalized_at
  then
    return new;
  end if;

  raise exception 'a finalized tax report snapshot is immutable except for being marked superseded'
    using errcode = '55000';
end;
$$;

revoke all on function public.prevent_finalized_snapshot_mutation() from public, anon, authenticated;

drop trigger if exists tax_report_snapshots_prevent_mutation on public.tax_report_snapshots;
create trigger tax_report_snapshots_prevent_mutation
  before update on public.tax_report_snapshots
  for each row
  execute function public.prevent_finalized_snapshot_mutation();

-- =======================================================================
-- 9. RLS — enabled and forced on every new table.
-- =======================================================================

alter table public.tax_profiles enable row level security;
alter table public.tax_profiles force row level security;
alter table public.tax_income_adjustments enable row level security;
alter table public.tax_income_adjustments force row level security;
alter table public.tax_deductions enable row level security;
alter table public.tax_deductions force row level security;
alter table public.tax_withholdings enable row level security;
alter table public.tax_withholdings force row level security;
alter table public.tax_payments enable row level security;
alter table public.tax_payments force row level security;
alter table public.tax_asset_classifications enable row level security;
alter table public.tax_asset_classifications force row level security;
alter table public.tax_reconciliation_items enable row level security;
alter table public.tax_reconciliation_items force row level security;
alter table public.tax_report_snapshots enable row level security;
alter table public.tax_report_snapshots force row level security;

drop policy if exists tax_profiles_select on public.tax_profiles;
create policy tax_profiles_select on public.tax_profiles for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.tax_profiles from public, anon, authenticated;
grant select on public.tax_profiles to authenticated;

drop policy if exists tax_income_adjustments_select on public.tax_income_adjustments;
create policy tax_income_adjustments_select on public.tax_income_adjustments for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.tax_income_adjustments from public, anon, authenticated;
grant select on public.tax_income_adjustments to authenticated;

drop policy if exists tax_deductions_select on public.tax_deductions;
create policy tax_deductions_select on public.tax_deductions for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.tax_deductions from public, anon, authenticated;
grant select on public.tax_deductions to authenticated;

drop policy if exists tax_withholdings_select on public.tax_withholdings;
create policy tax_withholdings_select on public.tax_withholdings for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.tax_withholdings from public, anon, authenticated;
grant select on public.tax_withholdings to authenticated;

drop policy if exists tax_payments_select on public.tax_payments;
create policy tax_payments_select on public.tax_payments for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.tax_payments from public, anon, authenticated;
grant select on public.tax_payments to authenticated;

drop policy if exists tax_asset_classifications_select on public.tax_asset_classifications;
create policy tax_asset_classifications_select on public.tax_asset_classifications for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.tax_asset_classifications from public, anon, authenticated;
grant select on public.tax_asset_classifications to authenticated;

drop policy if exists tax_reconciliation_items_select on public.tax_reconciliation_items;
create policy tax_reconciliation_items_select on public.tax_reconciliation_items for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.tax_reconciliation_items from public, anon, authenticated;
grant select on public.tax_reconciliation_items to authenticated;

drop policy if exists tax_report_snapshots_select on public.tax_report_snapshots;
create policy tax_report_snapshots_select on public.tax_report_snapshots for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.tax_report_snapshots from public, anon, authenticated;
grant select on public.tax_report_snapshots to authenticated;

-- =======================================================================
-- 10. RPCs — tax profile.
-- =======================================================================

create or replace function public.save_tax_profile(
  p_taxpayer_type text default 'individual',
  p_residential_status text default 'resident',
  p_has_business_or_professional_income boolean default false,
  p_has_salary_or_pension_income boolean default true,
  p_default_regime_preference text default null,
  p_age_band text default null,
  p_masked_pan_label text default null,
  p_notes text default null
)
returns public.tax_profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_profile public.tax_profiles;
begin
  if v_user_id is null then
    raise exception 'Sign in required' using errcode = '42501';
  end if;

  insert into public.tax_profiles (
    user_id, taxpayer_type, residential_status, has_business_or_professional_income,
    has_salary_or_pension_income, default_regime_preference, age_band, masked_pan_label, notes
  ) values (
    v_user_id, p_taxpayer_type, p_residential_status, p_has_business_or_professional_income,
    p_has_salary_or_pension_income, p_default_regime_preference, p_age_band, p_masked_pan_label, p_notes
  )
  on conflict (user_id) do update set
    taxpayer_type = excluded.taxpayer_type,
    residential_status = excluded.residential_status,
    has_business_or_professional_income = excluded.has_business_or_professional_income,
    has_salary_or_pension_income = excluded.has_salary_or_pension_income,
    default_regime_preference = excluded.default_regime_preference,
    age_band = excluded.age_band,
    masked_pan_label = excluded.masked_pan_label,
    notes = excluded.notes
  returning * into v_profile;

  return v_profile;
end;
$$;

revoke all on function public.save_tax_profile(text, text, boolean, boolean, text, text, text, text) from public, anon, authenticated;
grant execute on function public.save_tax_profile(text, text, boolean, boolean, text, text, text, text) to authenticated;

-- =======================================================================
-- 11. RPCs — income adjustments.
-- =======================================================================

create or replace function public.save_tax_income_adjustment(
  p_financial_year_id text,
  p_category text,
  p_gross_amount numeric,
  p_tds_amount numeric default 0,
  p_currency text default 'INR',
  p_is_exempt_candidate boolean default false,
  p_source_type text default 'manual',
  p_source_ledger_transaction_id uuid default null,
  p_source_investment_activity_id uuid default null,
  p_evidence_label text default null,
  p_notes text default null
)
returns public.tax_income_adjustments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_owner uuid;
  v_row public.tax_income_adjustments;
begin
  if v_user_id is null then
    raise exception 'Sign in required' using errcode = '42501';
  end if;

  if p_source_ledger_transaction_id is not null then
    select user_id into v_owner from public.ledger_transactions where id = p_source_ledger_transaction_id;
    if v_owner is null or v_owner <> v_user_id then
      raise exception 'Transaction not found' using errcode = '42501';
    end if;
  end if;
  if p_source_investment_activity_id is not null then
    select user_id into v_owner from public.investment_activities where id = p_source_investment_activity_id;
    if v_owner is null or v_owner <> v_user_id then
      raise exception 'Investment activity not found' using errcode = '42501';
    end if;
  end if;

  insert into public.tax_income_adjustments (
    user_id, financial_year_id, category, gross_amount, tds_amount, currency,
    is_exempt_candidate, source_type, source_ledger_transaction_id, source_investment_activity_id,
    evidence_label, notes
  ) values (
    v_user_id, p_financial_year_id, p_category, p_gross_amount, p_tds_amount, p_currency,
    p_is_exempt_candidate, p_source_type, p_source_ledger_transaction_id, p_source_investment_activity_id,
    p_evidence_label, p_notes
  )
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.save_tax_income_adjustment(text, text, numeric, numeric, text, boolean, text, uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.save_tax_income_adjustment(text, text, numeric, numeric, text, boolean, text, uuid, uuid, text, text) to authenticated;

comment on function public.save_tax_income_adjustment is
  'Duplicate source links are rejected by tax_income_adjustments_ledger_txn_unique / tax_income_adjustments_investment_activity_unique — a second attempt to classify the same ledger transaction or investment activity raises a 23505 unique-violation rather than silently creating a second, conflicting classification.';

create or replace function public.set_tax_income_adjustment_status(p_id uuid, p_status text)
returns public.tax_income_adjustments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_row public.tax_income_adjustments;
begin
  if v_user_id is null then
    raise exception 'Sign in required' using errcode = '42501';
  end if;
  if p_status not in ('draft', 'confirmed') then
    raise exception 'Invalid status' using errcode = '22023';
  end if;

  update public.tax_income_adjustments set status = p_status
  where id = p_id and user_id = v_user_id
  returning * into v_row;

  if v_row.id is null then
    raise exception 'Income adjustment not found' using errcode = '42501';
  end if;

  return v_row;
end;
$$;

revoke all on function public.set_tax_income_adjustment_status(uuid, text) from public, anon, authenticated;
grant execute on function public.set_tax_income_adjustment_status(uuid, text) to authenticated;

create or replace function public.delete_tax_income_adjustment(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then
    raise exception 'Sign in required' using errcode = '42501';
  end if;

  delete from public.tax_income_adjustments where id = p_id and user_id = v_user_id;
end;
$$;

revoke all on function public.delete_tax_income_adjustment(uuid) from public, anon, authenticated;
grant execute on function public.delete_tax_income_adjustment(uuid) to authenticated;

-- =======================================================================
-- 12. RPCs — deductions.
-- =======================================================================

create or replace function public.save_tax_deduction(
  p_financial_year_id text,
  p_section text,
  p_claimed_amount numeric,
  p_evidence_label text default null,
  p_masked_reference text default null,
  p_source_url text default null,
  p_notes text default null,
  p_deduction_id uuid default null
)
returns public.tax_deductions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_row public.tax_deductions;
begin
  if v_user_id is null then
    raise exception 'Sign in required' using errcode = '42501';
  end if;

  if p_deduction_id is not null then
    update public.tax_deductions set
      section = p_section,
      claimed_amount = p_claimed_amount,
      evidence_label = p_evidence_label,
      masked_reference = p_masked_reference,
      source_url = p_source_url,
      notes = p_notes
    where id = p_deduction_id and user_id = v_user_id
    returning * into v_row;

    if v_row.id is null then
      raise exception 'Deduction not found' using errcode = '42501';
    end if;
    return v_row;
  end if;

  insert into public.tax_deductions (
    user_id, financial_year_id, section, claimed_amount, evidence_label, masked_reference, source_url, notes
  ) values (
    v_user_id, p_financial_year_id, p_section, p_claimed_amount, p_evidence_label, p_masked_reference, p_source_url, p_notes
  )
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.save_tax_deduction(text, text, numeric, text, text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.save_tax_deduction(text, text, numeric, text, text, text, text, uuid) to authenticated;

create or replace function public.set_tax_deduction_status(p_id uuid, p_status text)
returns public.tax_deductions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_row public.tax_deductions;
begin
  if v_user_id is null then
    raise exception 'Sign in required' using errcode = '42501';
  end if;
  if p_status not in ('draft', 'confirmed') then
    raise exception 'Invalid status' using errcode = '22023';
  end if;

  update public.tax_deductions set status = p_status
  where id = p_id and user_id = v_user_id
  returning * into v_row;

  if v_row.id is null then
    raise exception 'Deduction not found' using errcode = '42501';
  end if;

  return v_row;
end;
$$;

revoke all on function public.set_tax_deduction_status(uuid, text) from public, anon, authenticated;
grant execute on function public.set_tax_deduction_status(uuid, text) to authenticated;

create or replace function public.delete_tax_deduction(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then
    raise exception 'Sign in required' using errcode = '42501';
  end if;

  delete from public.tax_deductions where id = p_id and user_id = v_user_id;
end;
$$;

revoke all on function public.delete_tax_deduction(uuid) from public, anon, authenticated;
grant execute on function public.delete_tax_deduction(uuid) to authenticated;

-- =======================================================================
-- 13. RPCs — withholdings (TDS/TCS).
-- =======================================================================

create or replace function public.save_tax_withholding(
  p_financial_year_id text,
  p_withholding_type text,
  p_deductor_name text,
  p_gross_amount numeric,
  p_tax_withheld numeric,
  p_withheld_on date,
  p_masked_tan text default null,
  p_income_category text default null,
  p_reference_label text default null,
  p_evidence_source text default null,
  p_notes text default null,
  p_withholding_id uuid default null
)
returns public.tax_withholdings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_row public.tax_withholdings;
begin
  if v_user_id is null then
    raise exception 'Sign in required' using errcode = '42501';
  end if;

  if p_withholding_id is not null then
    update public.tax_withholdings set
      withholding_type = p_withholding_type,
      deductor_name = p_deductor_name,
      gross_amount = p_gross_amount,
      tax_withheld = p_tax_withheld,
      withheld_on = p_withheld_on,
      masked_tan = p_masked_tan,
      income_category = p_income_category,
      reference_label = p_reference_label,
      evidence_source = p_evidence_source,
      notes = p_notes
    where id = p_withholding_id and user_id = v_user_id
    returning * into v_row;

    if v_row.id is null then
      raise exception 'Withholding record not found' using errcode = '42501';
    end if;
    return v_row;
  end if;

  insert into public.tax_withholdings (
    user_id, financial_year_id, withholding_type, deductor_name, gross_amount, tax_withheld,
    withheld_on, masked_tan, income_category, reference_label, evidence_source, notes
  ) values (
    v_user_id, p_financial_year_id, p_withholding_type, p_deductor_name, p_gross_amount, p_tax_withheld,
    p_withheld_on, p_masked_tan, p_income_category, p_reference_label, p_evidence_source, p_notes
  )
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.save_tax_withholding(text, text, text, numeric, numeric, date, text, text, text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.save_tax_withholding(text, text, text, numeric, numeric, date, text, text, text, text, text, uuid) to authenticated;

create or replace function public.set_tax_withholding_reconciliation_status(p_id uuid, p_status text)
returns public.tax_withholdings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_row public.tax_withholdings;
begin
  if v_user_id is null then
    raise exception 'Sign in required' using errcode = '42501';
  end if;
  if p_status not in ('unreviewed', 'matched', 'difference', 'user_confirmed') then
    raise exception 'Invalid status' using errcode = '22023';
  end if;

  update public.tax_withholdings set reconciliation_status = p_status
  where id = p_id and user_id = v_user_id
  returning * into v_row;

  if v_row.id is null then
    raise exception 'Withholding record not found' using errcode = '42501';
  end if;

  return v_row;
end;
$$;

revoke all on function public.set_tax_withholding_reconciliation_status(uuid, text) from public, anon, authenticated;
grant execute on function public.set_tax_withholding_reconciliation_status(uuid, text) to authenticated;

create or replace function public.delete_tax_withholding(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then
    raise exception 'Sign in required' using errcode = '42501';
  end if;

  delete from public.tax_withholdings where id = p_id and user_id = v_user_id;
end;
$$;

revoke all on function public.delete_tax_withholding(uuid) from public, anon, authenticated;
grant execute on function public.delete_tax_withholding(uuid) to authenticated;

-- =======================================================================
-- 14. RPCs — tax payments (advance/self-assessment/refund).
-- =======================================================================

create or replace function public.save_tax_payment(
  p_financial_year_id text,
  p_payment_type text,
  p_amount numeric,
  p_paid_on date,
  p_challan_reference text default null,
  p_related_transaction_id uuid default null,
  p_notes text default null
)
returns public.tax_payments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_owner uuid;
  v_row public.tax_payments;
begin
  if v_user_id is null then
    raise exception 'Sign in required' using errcode = '42501';
  end if;

  if p_related_transaction_id is not null then
    select user_id into v_owner from public.ledger_transactions where id = p_related_transaction_id;
    if v_owner is null or v_owner <> v_user_id then
      raise exception 'Transaction not found' using errcode = '42501';
    end if;
  end if;

  insert into public.tax_payments (
    user_id, financial_year_id, payment_type, amount, paid_on, challan_reference, related_transaction_id, notes
  ) values (
    v_user_id, p_financial_year_id, p_payment_type, p_amount, p_paid_on, p_challan_reference, p_related_transaction_id, p_notes
  )
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.save_tax_payment(text, text, numeric, date, text, uuid, text) from public, anon, authenticated;
grant execute on function public.save_tax_payment(text, text, numeric, date, text, uuid, text) to authenticated;

create or replace function public.delete_tax_payment(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then
    raise exception 'Sign in required' using errcode = '42501';
  end if;

  delete from public.tax_payments where id = p_id and user_id = v_user_id;
end;
$$;

revoke all on function public.delete_tax_payment(uuid) from public, anon, authenticated;
grant execute on function public.delete_tax_payment(uuid) to authenticated;

-- =======================================================================
-- 15. RPCs — asset classification.
-- =======================================================================

create or replace function public.save_tax_asset_classification(
  p_investment_asset_id uuid,
  p_asset_class text,
  p_unsupported_reason text default null,
  p_notes text default null
)
returns public.tax_asset_classifications
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_owner uuid;
  v_row public.tax_asset_classifications;
begin
  if v_user_id is null then
    raise exception 'Sign in required' using errcode = '42501';
  end if;

  select user_id into v_owner from public.investment_assets where id = p_investment_asset_id;
  if v_owner is null or v_owner <> v_user_id then
    raise exception 'Investment asset not found' using errcode = '42501';
  end if;

  insert into public.tax_asset_classifications (
    user_id, investment_asset_id, asset_class, unsupported_reason, notes, confirmed_at
  ) values (
    v_user_id, p_investment_asset_id, p_asset_class, p_unsupported_reason, p_notes, now()
  )
  on conflict (user_id, investment_asset_id) do update set
    asset_class = excluded.asset_class,
    unsupported_reason = excluded.unsupported_reason,
    notes = excluded.notes,
    confirmed_at = now()
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.save_tax_asset_classification(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.save_tax_asset_classification(uuid, text, text, text) to authenticated;

-- =======================================================================
-- 16. RPCs — AIS/26AS reconciliation.
-- =======================================================================

create or replace function public.save_tax_reconciliation_item(
  p_financial_year_id text,
  p_source text,
  p_income_category text,
  p_reported_amount numeric default null,
  p_processed_amount numeric default null,
  p_penra_amount numeric default null,
  p_accepted_amount numeric default null,
  p_status text default 'unreviewed',
  p_explanation text default null,
  p_evidence_source text default null,
  p_evidence_date date default null,
  p_item_id uuid default null
)
returns public.tax_reconciliation_items
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_row public.tax_reconciliation_items;
begin
  if v_user_id is null then
    raise exception 'Sign in required' using errcode = '42501';
  end if;

  if p_item_id is not null then
    update public.tax_reconciliation_items set
      reported_amount = p_reported_amount,
      processed_amount = p_processed_amount,
      penra_amount = p_penra_amount,
      accepted_amount = p_accepted_amount,
      status = p_status,
      explanation = p_explanation,
      evidence_source = p_evidence_source,
      evidence_date = p_evidence_date,
      last_reviewed_at = now()
    where id = p_item_id and user_id = v_user_id
    returning * into v_row;

    if v_row.id is null then
      raise exception 'Reconciliation item not found' using errcode = '42501';
    end if;
    return v_row;
  end if;

  insert into public.tax_reconciliation_items (
    user_id, financial_year_id, source, income_category, reported_amount, processed_amount,
    penra_amount, accepted_amount, status, explanation, evidence_source, evidence_date, last_reviewed_at
  ) values (
    v_user_id, p_financial_year_id, p_source, p_income_category, p_reported_amount, p_processed_amount,
    p_penra_amount, p_accepted_amount, p_status, p_explanation, p_evidence_source, p_evidence_date, now()
  )
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.save_tax_reconciliation_item(text, text, text, numeric, numeric, numeric, numeric, text, text, text, date, uuid) from public, anon, authenticated;
grant execute on function public.save_tax_reconciliation_item(text, text, text, numeric, numeric, numeric, numeric, text, text, text, date, uuid) to authenticated;

create or replace function public.delete_tax_reconciliation_item(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then
    raise exception 'Sign in required' using errcode = '42501';
  end if;

  delete from public.tax_reconciliation_items where id = p_id and user_id = v_user_id;
end;
$$;

revoke all on function public.delete_tax_reconciliation_item(uuid) from public, anon, authenticated;
grant execute on function public.delete_tax_reconciliation_item(uuid) to authenticated;

-- =======================================================================
-- 17. RPCs — report snapshots.
-- =======================================================================

-- 17a. Creates a new draft snapshot. When p_supersedes_snapshot_id is
-- given, the referenced snapshot must belong to the caller and be
-- 'finalized' — it is then marked 'superseded' (never deleted, never
-- otherwise edited) in the same transaction as the new snapshot's insert.
create or replace function public.create_tax_report_snapshot(
  p_financial_year_id text,
  p_assessment_year_id text,
  p_rule_set_version text,
  p_completeness_status text,
  p_snapshot_data jsonb,
  p_warnings jsonb default '[]'::jsonb,
  p_supersedes_snapshot_id uuid default null
)
returns public.tax_report_snapshots
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_prior public.tax_report_snapshots;
  v_new public.tax_report_snapshots;
begin
  if v_user_id is null then
    raise exception 'Sign in required' using errcode = '42501';
  end if;

  if p_supersedes_snapshot_id is not null then
    select * into v_prior from public.tax_report_snapshots
      where id = p_supersedes_snapshot_id and user_id = v_user_id;
    if v_prior.id is null then
      raise exception 'Snapshot to supersede not found' using errcode = '42501';
    end if;
    if v_prior.status <> 'finalized' then
      raise exception 'Only a finalized snapshot can be superseded' using errcode = '22023';
    end if;
  end if;

  insert into public.tax_report_snapshots (
    user_id, financial_year_id, assessment_year_id, rule_set_version,
    completeness_status, snapshot_data, warnings, supersedes_snapshot_id
  ) values (
    v_user_id, p_financial_year_id, p_assessment_year_id, p_rule_set_version,
    p_completeness_status, p_snapshot_data, p_warnings, p_supersedes_snapshot_id
  )
  returning * into v_new;

  if p_supersedes_snapshot_id is not null then
    update public.tax_report_snapshots
      set status = 'superseded', superseded_by = v_new.id
      where id = p_supersedes_snapshot_id;
  end if;

  return v_new;
end;
$$;

revoke all on function public.create_tax_report_snapshot(text, text, text, text, jsonb, jsonb, uuid) from public, anon, authenticated;
grant execute on function public.create_tax_report_snapshot(text, text, text, text, jsonb, jsonb, uuid) to authenticated;

-- 17b. A draft/needs_review/ready snapshot may be freely regenerated in
-- place (never once finalized — see the shape check + trigger above).
create or replace function public.update_tax_report_snapshot_draft(
  p_snapshot_id uuid,
  p_completeness_status text,
  p_snapshot_data jsonb,
  p_warnings jsonb default '[]'::jsonb
)
returns public.tax_report_snapshots
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_row public.tax_report_snapshots;
begin
  if v_user_id is null then
    raise exception 'Sign in required' using errcode = '42501';
  end if;

  update public.tax_report_snapshots set
    completeness_status = p_completeness_status,
    snapshot_data = p_snapshot_data,
    warnings = p_warnings,
    generated_at = now()
  where id = p_snapshot_id and user_id = v_user_id and status in ('draft', 'needs_review', 'ready')
  returning * into v_row;

  if v_row.id is null then
    raise exception 'Draft snapshot not found or already finalized' using errcode = '42501';
  end if;

  return v_row;
end;
$$;

revoke all on function public.update_tax_report_snapshot_draft(uuid, text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.update_tax_report_snapshot_draft(uuid, text, jsonb, jsonb) to authenticated;

-- 17c. Finalizes a snapshot — the one, one-way transition into
-- immutability. Rejects an already-finalized/superseded snapshot.
create or replace function public.finalize_tax_report_snapshot(p_snapshot_id uuid)
returns public.tax_report_snapshots
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_row public.tax_report_snapshots;
begin
  if v_user_id is null then
    raise exception 'Sign in required' using errcode = '42501';
  end if;

  update public.tax_report_snapshots
    set status = 'finalized', finalized_at = now()
    where id = p_snapshot_id and user_id = v_user_id and status in ('draft', 'needs_review', 'ready')
  returning * into v_row;

  if v_row.id is null then
    raise exception 'Snapshot not found, or already finalized/superseded' using errcode = '22023';
  end if;

  return v_row;
end;
$$;

revoke all on function public.finalize_tax_report_snapshot(uuid) from public, anon, authenticated;
grant execute on function public.finalize_tax_report_snapshot(uuid) to authenticated;

comment on function public.finalize_tax_report_snapshot is
  'The one, one-way transition into immutability for a tax report snapshot. After this call, prevent_finalized_snapshot_mutation blocks every further change except the single recognised supersede transition performed by create_tax_report_snapshot.';
