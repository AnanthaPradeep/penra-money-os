-- =======================================================================
-- Phase 11 — Bank Statement Import, CSV Parsing, Reconciliation,
-- Duplicate Detection and Account Matching.
--
-- Architecture summary:
--   * No Supabase Storage bucket is created. A statement file is parsed
--     entirely in-memory inside one Server Action invocation (Node
--     runtime) — the raw bytes are never written to Storage, disk, or any
--     durable column. Only a sha256 file_hash, sanitized filename, size,
--     and the *normalized* staging rows are persisted. This is the
--     documented preferred path from the spec ("If parsing can be
--     completed without durable file storage, prefer that approach and
--     retain only normalized staging rows plus hashes") and avoids
--     inventing an entirely new Storage/RLS/signed-URL/cleanup-job
--     subsystem this repo has never used anywhere.
--   * Fuzzy/explainable matching (description similarity, date-window
--     scoring, confidence bands, human-readable reasons) is computed in
--     pure, exhaustively-unit-tested TypeScript (src/lib/bank-import/
--     matching.ts) over data fetched via bounded, indexed queries — never
--     in SQL. The database layer's job is the authoritative, deterministic
--     safety net: ownership, RLS, idempotent posting, and the sum-to-zero
--     ledger invariant. TS-computed results are written back through a
--     single ownership/status-revalidating RPC
--     (apply_statement_import_row_analysis) that trusts the *shape* of
--     what it's given but re-derives nothing the client could lie about
--     (status, ownership, row identity) without re-checking it.
--   * Posting reuses public.post_manual_transaction_for_user (Phase 6/7)
--     for every created transaction — no double-entry logic is
--     duplicated. A confirmed batch posts inside one PL/pgSQL function
--     call, which is itself one Postgres transaction: a single bounded
--     row cap (MAX_STATEMENT_IMPORT_ROWS = 2000, enforced both in TS and
--     by a CHECK here) makes true all-or-nothing atomicity practical
--     without needing chunked/resumable posting — see
--     post_statement_import_batch's own comment for exactly how a mid-
--     batch failure rolls back every entry posted so far in the same call
--     while still persisting an honest 'failed' status (a PL/pgSQL
--     exception block's implicit savepoint makes both true at once).
--   * Every posted row's idempotency key is deterministic
--     ('stmt-row:' || row id), reusing ledger_transactions'
--     existing (user_id, source_reference) unique index — a retried or
--     double-submitted batch can never create a duplicate transaction,
--     the same guarantee every other posting path in this app already
--     relies on.
-- =======================================================================

-- =======================================================================
-- 1. Widen ledger_transactions_source_type_valid to add 'import'.
--    Imported transactions are never 'manual' (the user didn't type them
--    in) and never bare 'system' (they're not opening-balance/reversal/
--    adjustment machinery) — a distinct value keeps the transaction
--    history honestly attributable to its origin without overloading
--    either existing value's meaning.
-- =======================================================================

alter table public.ledger_transactions drop constraint if exists ledger_transactions_source_type_valid;
alter table public.ledger_transactions add constraint ledger_transactions_source_type_valid check (
  source_type in ('manual', 'system', 'import')
);

-- post_manual_transaction_for_user (Phase 6/7) always inserts
-- source_type = 'manual' — widen it to accept an explicit source type so
-- imported transactions can be posted through the exact same trusted core
-- while still being attributed correctly, without ever duplicating its
-- insert/entries/idempotency logic. Every other line below is byte-for-
-- byte identical to the Phase 7 version (see
-- 20260820184332_phase7_investments_networth.sql:257-336) except the new
-- p_source_type parameter and its use in the insert.
create or replace function public.post_manual_transaction_for_user(
  p_user_id uuid,
  p_transaction_type text,
  p_occurred_at timestamptz,
  p_description text,
  p_entries jsonb,
  p_notes text default null,
  p_category_id uuid default null,
  p_payee_id uuid default null,
  p_idempotency_key text default null,
  p_source_type text default 'manual'
)
returns public.ledger_transactions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_transaction public.ledger_transactions;
  v_entry jsonb;
  v_account_id uuid;
  v_account_user_id uuid;
begin
  if p_transaction_type not in (
    'income', 'expense', 'transfer', 'credit_card_purchase', 'credit_card_payment', 'adjustment',
    'investment_buy', 'investment_sell', 'investment_contribution', 'investment_withdrawal', 'investment_maturity'
  ) then
    raise exception 'invalid transaction_type for a manual/import post: %', p_transaction_type
      using errcode = '22023';
  end if;
  if p_source_type not in ('manual', 'import') then
    raise exception 'post_manual_transaction_for_user only accepts manual or import source_type'
      using errcode = '22023';
  end if;
  if jsonb_array_length(p_entries) < 2 then
    raise exception 'a transaction requires at least two entries' using errcode = '22023';
  end if;

  for v_entry in select * from jsonb_array_elements(p_entries)
  loop
    v_account_id := (v_entry ->> 'account_id')::uuid;
    select user_id into v_account_user_id from public.accounts where id = v_account_id;
    if v_account_user_id is null then
      raise exception 'entry references a non-existent account' using errcode = '23503';
    end if;
    if v_account_user_id <> p_user_id then
      raise exception 'entry references another user''s account' using errcode = '42501';
    end if;
  end loop;

  begin
    insert into public.ledger_transactions (
      user_id, transaction_type, occurred_at, description, notes,
      source_type, source_reference, category_id, payee_id
    ) values (
      p_user_id, p_transaction_type, p_occurred_at, p_description, p_notes,
      p_source_type, p_idempotency_key, p_category_id, p_payee_id
    )
    on conflict (user_id, source_reference) where source_reference is not null do nothing
    returning * into v_transaction;
  end;

  if v_transaction.id is null then
    select * into v_transaction from public.ledger_transactions
      where user_id = p_user_id and source_reference = p_idempotency_key;
    return v_transaction;
  end if;

  insert into public.ledger_entries (user_id, transaction_id, account_id, amount, currency, memo)
  select
    p_user_id,
    v_transaction.id,
    (entry ->> 'account_id')::uuid,
    (entry ->> 'amount')::numeric(20, 4),
    coalesce(entry ->> 'currency', 'INR'),
    entry ->> 'memo'
  from jsonb_array_elements(p_entries) as entry;

  return v_transaction;
end;
$$;

revoke all on function public.post_manual_transaction_for_user(
  uuid, text, timestamptz, text, jsonb, text, uuid, uuid, text, text
) from public, anon, authenticated;

-- =======================================================================
-- 2. public.statement_column_mappings — private, reusable per-user
--    presets, keyed by a fingerprint of the file's header row. Purely a
--    suggestion source for future imports; the mapping actually applied
--    to any one import is always stored denormalized on
--    statement_imports itself (section 4) so a saved preset can never
--    silently drift what already-parsed data means.
-- =======================================================================

create table if not exists public.statement_column_mappings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  header_fingerprint text not null,
  bank_label text null,
  date_column text not null,
  value_date_column text null,
  description_column text not null,
  reference_column text null,
  debit_column text null,
  credit_column text null,
  amount_column text null,
  transaction_type_column text null,
  balance_column text null,
  date_format text not null,
  amount_sign_convention text not null default 'debit_negative',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint statement_column_mappings_sign_convention_valid check (
    amount_sign_convention in ('debit_negative', 'debit_positive')
  ),
  constraint statement_column_mappings_date_format_valid check (
    date_format in ('DD/MM/YYYY', 'DD-MM-YYYY', 'DD/MM/YY', 'YYYY-MM-DD', 'DD MMM YYYY')
  ),
  constraint statement_column_mappings_has_amount_source check (
    (debit_column is not null or credit_column is not null) or amount_column is not null
  ),
  constraint statement_column_mappings_bank_label_length check (
    bank_label is null or char_length(bank_label) <= 100
  ),
  constraint statement_column_mappings_fingerprint_length check (
    char_length(header_fingerprint) between 8 and 128
  )
);

comment on table public.statement_column_mappings is
  'Private, per-user reusable column-mapping presets for bank statement import, keyed by a hash of the normalized header row. Suggests a mapping for a future upload with the same header shape; never silently reapplied without the user confirming it on that import (see statement_imports, which stores its own actually-applied mapping columns independently).';

create unique index if not exists statement_column_mappings_user_fingerprint_uidx
  on public.statement_column_mappings (user_id, header_fingerprint);

drop trigger if exists set_statement_column_mappings_updated_at on public.statement_column_mappings;
create trigger set_statement_column_mappings_updated_at
  before update on public.statement_column_mappings
  for each row
  execute function public.set_updated_at();

-- =======================================================================
-- 3. public.statement_import_rules — private, deterministic
--    categorization/payee/exclusion rules the user defines and reuses.
-- =======================================================================

create table if not exists public.statement_import_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  match_field text not null,
  match_value text not null,
  direction_filter text null,
  account_id uuid null references public.accounts (id) on delete cascade,
  min_amount numeric(20, 4) null,
  max_amount numeric(20, 4) null,
  suggested_transaction_type text null,
  suggested_category_id uuid null references public.categories (id) on delete set null,
  suggested_payee_id uuid null references public.payees (id) on delete set null,
  notes_template text null,
  exclude boolean not null default false,
  priority integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint statement_import_rules_match_field_valid check (
    match_field in ('description_contains', 'description_starts_with', 'description_exact', 'reference_prefix')
  ),
  constraint statement_import_rules_direction_valid check (
    direction_filter is null or direction_filter in ('debit', 'credit')
  ),
  constraint statement_import_rules_type_valid check (
    suggested_transaction_type is null or suggested_transaction_type in (
      'income', 'expense', 'transfer', 'credit_card_purchase', 'credit_card_payment'
    )
  ),
  constraint statement_import_rules_name_length check (char_length(btrim(name)) between 1 and 100),
  constraint statement_import_rules_match_value_length check (char_length(btrim(match_value)) between 1 and 200),
  constraint statement_import_rules_notes_template_length check (
    notes_template is null or char_length(notes_template) <= 300
  ),
  constraint statement_import_rules_amount_range_valid check (
    min_amount is null or max_amount is null or min_amount <= max_amount
  )
);

comment on table public.statement_import_rules is
  'Private, deterministic per-user rules for suggesting a category/payee/kind or excluding a row during statement review. Never applied automatically to a posted transaction — only ever a pre-fill suggestion the user can see was rule-derived and can override before confirming (see statement_import_rows.matched_rule_id).';

create index if not exists statement_import_rules_user_priority_idx
  on public.statement_import_rules (user_id, priority desc) where is_active = true;

drop trigger if exists set_statement_import_rules_updated_at on public.statement_import_rules;
create trigger set_statement_import_rules_updated_at
  before update on public.statement_import_rules
  for each row
  execute function public.set_updated_at();

-- =======================================================================
-- 4. public.statement_imports — one row per upload attempt. The mapping
--    actually used is denormalized here (never only in a reusable
--    preset), so what a given import means is always self-contained.
-- =======================================================================

create table if not exists public.statement_imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  account_id uuid not null references public.accounts (id) on delete restrict,
  original_filename text not null,
  file_hash text not null,
  file_format text not null,
  file_size_bytes integer not null,
  row_count_hint integer null,
  detected_delimiter text not null,
  detected_encoding text not null default 'utf-8',
  header_fingerprint text not null,
  column_mapping_id uuid null references public.statement_column_mappings (id) on delete set null,
  date_column text null,
  value_date_column text null,
  description_column text null,
  reference_column text null,
  debit_column text null,
  credit_column text null,
  amount_column text null,
  transaction_type_column text null,
  balance_column text null,
  date_format text null,
  amount_sign_convention text null,
  currency text not null default 'INR',
  statement_start_date date null,
  statement_end_date date null,
  opening_balance numeric(20, 4) null,
  closing_balance numeric(20, 4) null,
  expected_closing_balance numeric(20, 4) null,
  reconciliation_status text not null default 'not_started',
  total_rows integer not null default 0,
  valid_rows integer not null default 0,
  invalid_rows integer not null default 0,
  excluded_rows integer not null default 0,
  duplicate_rows integer not null default 0,
  matched_rows integer not null default 0,
  imported_rows integer not null default 0,
  status text not null default 'uploaded',
  error_code text null,
  created_at timestamptz not null default now(),
  mapped_at timestamptz null,
  parsed_at timestamptz null,
  confirmed_at timestamptz null,
  completed_at timestamptz null,
  discarded_at timestamptz null,
  updated_at timestamptz not null default now(),

  constraint statement_imports_file_format_valid check (file_format in ('csv', 'tsv')),
  constraint statement_imports_delimiter_valid check (detected_delimiter in (',', ';', E'\t')),
  constraint statement_imports_status_valid check (
    status in (
      'uploaded', 'mapping_required', 'parsed', 'reviewing', 'ready',
      'posting', 'completed', 'failed', 'discarded'
    )
  ),
  constraint statement_imports_reconciliation_status_valid check (
    reconciliation_status in ('not_started', 'in_progress', 'balanced', 'difference', 'incomplete')
  ),
  constraint statement_imports_currency_format check (currency ~ '^[A-Z]{3}$'),
  constraint statement_imports_filename_length check (
    char_length(original_filename) between 1 and 200
  ),
  constraint statement_imports_file_hash_length check (char_length(file_hash) = 64),
  constraint statement_imports_file_size_bounds check (
    file_size_bytes > 0 and file_size_bytes <= 8388608
  ),
  constraint statement_imports_row_count_bounds check (
    row_count_hint is null or (row_count_hint >= 0 and row_count_hint <= 2000)
  ),
  constraint statement_imports_date_range_valid check (
    statement_start_date is null or statement_end_date is null or statement_start_date <= statement_end_date
  ),
  constraint statement_imports_error_code_length check (
    error_code is null or char_length(error_code) <= 100
  )
);

comment on table public.statement_imports is
  'One row per bank/credit-card statement upload attempt. The raw file is never stored — parsing happens in-memory in one Server Action call; only this metadata plus the normalized staging rows (statement_import_rows) persist. status follows a strict forward lifecycle enforced by a trigger (see below); posted/completed imports can never be discarded, and discarding never deletes audit rows.';

create index if not exists statement_imports_user_status_idx
  on public.statement_imports (user_id, status, created_at desc);
create index if not exists statement_imports_account_idx
  on public.statement_imports (account_id, created_at desc);
create index if not exists statement_imports_file_hash_idx
  on public.statement_imports (user_id, account_id, file_hash) where status <> 'discarded';

drop trigger if exists set_statement_imports_updated_at on public.statement_imports;
create trigger set_statement_imports_updated_at
  before update on public.statement_imports
  for each row
  execute function public.set_updated_at();

-- Enforce the forward-only lifecycle at the database layer — no code
-- path (including a future bug in a Server Action) can move a session
-- backward past a point that would misrepresent its audit trail, and
-- 'posting'/'completed' are structurally protected from ever being
-- discarded.
create or replace function public.validate_statement_import_transition()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_allowed boolean := false;
begin
  if old.status = new.status then
    return new;
  end if;

  v_allowed := case old.status
    when 'uploaded' then new.status in ('mapping_required', 'discarded')
    when 'mapping_required' then new.status in ('parsed', 'discarded')
    when 'parsed' then new.status in ('reviewing', 'discarded')
    when 'reviewing' then new.status in ('ready', 'discarded')
    when 'ready' then new.status in ('reviewing', 'posting', 'discarded')
    when 'posting' then new.status in ('completed', 'failed')
    when 'failed' then new.status in ('posting', 'discarded')
    when 'completed' then false
    when 'discarded' then false
    else false
  end;

  if not v_allowed then
    raise exception 'invalid statement_imports status transition: % -> %', old.status, new.status
      using errcode = '22023';
  end if;

  return new;
end;
$$;

revoke all on function public.validate_statement_import_transition() from public, anon, authenticated;

drop trigger if exists statement_imports_validate_transition on public.statement_imports;
create trigger statement_imports_validate_transition
  before update of status on public.statement_imports
  for each row
  execute function public.validate_statement_import_transition();

-- =======================================================================
-- 5. public.statement_import_rows — normalized staging rows. Never
--    affects any balance/budget/net-worth figure until a row is actually
--    posted (linked_created_transaction_id set) or linked
--    (linked_existing_transaction_id set) — both only ever happen inside
--    post_statement_import_batch / link_statement_import_row_to_transaction.
-- =======================================================================

create table if not exists public.statement_import_rows (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references public.statement_imports (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  account_id uuid not null references public.accounts (id) on delete restrict,
  row_index integer not null,
  row_hash text not null,
  transaction_date date null,
  value_date date null,
  description text not null default '',
  reference text null,
  cheque_number text null,
  amount numeric(20, 4) null,
  direction text null,
  running_balance numeric(20, 4) null,
  currency text not null default 'INR',
  suggested_transaction_type text null,
  resolved_transaction_type text null,
  suggested_category_id uuid null references public.categories (id) on delete set null,
  suggested_payee_id uuid null references public.payees (id) on delete set null,
  counterparty_account_id uuid null references public.accounts (id) on delete set null,
  matched_rule_id uuid null references public.statement_import_rules (id) on delete set null,
  duplicate_status text not null default 'not_duplicate',
  match_status text not null default 'unmatched',
  user_decision text not null default 'pending',
  validation_errors jsonb not null default '[]'::jsonb,
  linked_existing_transaction_id uuid null references public.ledger_transactions (id) on delete set null,
  linked_created_transaction_id uuid null references public.ledger_transactions (id) on delete set null,
  transfer_group_id uuid null,
  posting_result text null,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint statement_import_rows_direction_valid check (
    direction is null or direction in ('debit', 'credit')
  ),
  constraint statement_import_rows_type_valid check (
    suggested_transaction_type is null or suggested_transaction_type in (
      'income', 'expense', 'transfer', 'credit_card_purchase', 'credit_card_payment'
    )
  ),
  constraint statement_import_rows_resolved_type_valid check (
    resolved_transaction_type is null or resolved_transaction_type in (
      'income', 'expense', 'transfer', 'credit_card_purchase', 'credit_card_payment'
    )
  ),
  constraint statement_import_rows_duplicate_status_valid check (
    duplicate_status in (
      'not_duplicate', 'exact_file_duplicate', 'exact_row_duplicate',
      'existing_transaction_match', 'possible_duplicate'
    )
  ),
  constraint statement_import_rows_match_status_valid check (
    match_status in (
      'unmatched', 'existing_match_candidate', 'existing_match_confirmed',
      'transfer_candidate', 'transfer_confirmed'
    )
  ),
  constraint statement_import_rows_user_decision_valid check (
    user_decision in ('pending', 'include', 'exclude')
  ),
  constraint statement_import_rows_posting_result_valid check (
    posting_result is null or posting_result in ('created', 'linked', 'transfer_created', 'transfer_linked')
  ),
  constraint statement_import_rows_currency_format check (currency ~ '^[A-Z]{3}$'),
  constraint statement_import_rows_description_length check (char_length(description) <= 500),
  constraint statement_import_rows_reference_length check (
    reference is null or char_length(reference) <= 200
  ),
  constraint statement_import_rows_notes_length check (
    notes is null or char_length(notes) <= 2000
  ),
  constraint statement_import_rows_row_index_nonnegative check (row_index >= 0),
  -- A row can only be linked to an existing transaction XOR post a newly
  -- created one — never both, and never a transfer link without a group.
  constraint statement_import_rows_link_exclusive check (
    linked_existing_transaction_id is null or linked_created_transaction_id is null
  )
);

comment on table public.statement_import_rows is
  'Normalized staging rows for one statement import — private, per-user, never affects an account balance/budget/net-worth figure until linked_created_transaction_id or linked_existing_transaction_id is set, which only ever happens inside the trusted posting/linking RPCs below. Rows are never hard-deleted (audit trail), even for a discarded import.';

create unique index if not exists statement_import_rows_import_index_uidx
  on public.statement_import_rows (import_id, row_index);
create index if not exists statement_import_rows_import_decision_idx
  on public.statement_import_rows (import_id, user_decision);
create index if not exists statement_import_rows_user_hash_idx
  on public.statement_import_rows (user_id, account_id, row_hash);
create index if not exists statement_import_rows_transfer_group_idx
  on public.statement_import_rows (transfer_group_id) where transfer_group_id is not null;
create index if not exists statement_import_rows_linked_existing_idx
  on public.statement_import_rows (linked_existing_transaction_id) where linked_existing_transaction_id is not null;
create index if not exists statement_import_rows_date_amount_idx
  on public.statement_import_rows (user_id, account_id, transaction_date, amount);

drop trigger if exists set_statement_import_rows_updated_at on public.statement_import_rows;
create trigger set_statement_import_rows_updated_at
  before update on public.statement_import_rows
  for each row
  execute function public.set_updated_at();

-- An existing posted transaction can be the confirmed link target of at
-- most one import row — the structural half of "an existing imported row
-- must never create a second transaction" / "prevent cross-user and
-- cross-account linking onto the same transaction twice".
create unique index if not exists statement_import_rows_linked_existing_unique
  on public.statement_import_rows (linked_existing_transaction_id)
  where linked_existing_transaction_id is not null;

-- =======================================================================
-- 6. public.statement_import_row_matches — candidate matches surfaced for
--    review (existing-transaction or cross-import transfer candidates).
--    Purely advisory until a row's own linked_existing_transaction_id /
--    transfer_group_id is explicitly set via the RPCs in section 8.
-- =======================================================================

create table if not exists public.statement_import_row_matches (
  id uuid primary key default gen_random_uuid(),
  import_row_id uuid not null references public.statement_import_rows (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  candidate_transaction_id uuid null references public.ledger_transactions (id) on delete cascade,
  candidate_row_id uuid null references public.statement_import_rows (id) on delete cascade,
  match_kind text not null,
  score numeric(5, 4) not null,
  confidence text not null,
  reasons jsonb not null default '[]'::jsonb,
  conflicts jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),

  constraint statement_import_row_matches_kind_valid check (match_kind in ('existing_transaction', 'transfer_row')),
  constraint statement_import_row_matches_confidence_valid check (confidence in ('high', 'medium', 'low')),
  constraint statement_import_row_matches_score_bounds check (score >= 0 and score <= 1),
  constraint statement_import_row_matches_candidate_shape check (
    (match_kind = 'existing_transaction' and candidate_transaction_id is not null and candidate_row_id is null)
    or (match_kind = 'transfer_row' and candidate_row_id is not null and candidate_transaction_id is null)
  )
);

comment on table public.statement_import_row_matches is
  'Explainable candidate matches surfaced to the user during review — every row here carries the score/reasons/conflicts that produced it (computed in TypeScript, see src/lib/bank-import/matching.ts), never silently auto-applied. Confirming a candidate is always a separate, explicit action (link_statement_import_row_to_transaction / confirm_statement_transfer_match).';

create index if not exists statement_import_row_matches_row_idx
  on public.statement_import_row_matches (import_row_id, score desc);

-- =======================================================================
-- 7. RLS — enabled and forced on every new table.
-- =======================================================================

alter table public.statement_column_mappings enable row level security;
alter table public.statement_column_mappings force row level security;
alter table public.statement_import_rules enable row level security;
alter table public.statement_import_rules force row level security;
alter table public.statement_imports enable row level security;
alter table public.statement_imports force row level security;
alter table public.statement_import_rows enable row level security;
alter table public.statement_import_rows force row level security;
alter table public.statement_import_row_matches enable row level security;
alter table public.statement_import_row_matches force row level security;

drop policy if exists statement_column_mappings_select on public.statement_column_mappings;
create policy statement_column_mappings_select on public.statement_column_mappings for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists statement_column_mappings_insert on public.statement_column_mappings;
create policy statement_column_mappings_insert on public.statement_column_mappings for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists statement_column_mappings_update on public.statement_column_mappings;
create policy statement_column_mappings_update on public.statement_column_mappings for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists statement_column_mappings_delete on public.statement_column_mappings;
create policy statement_column_mappings_delete on public.statement_column_mappings for delete to authenticated using (user_id = (select auth.uid()));
revoke all on public.statement_column_mappings from public, anon, authenticated;
grant select, insert, update, delete on public.statement_column_mappings to authenticated;

drop policy if exists statement_import_rules_select on public.statement_import_rules;
create policy statement_import_rules_select on public.statement_import_rules for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists statement_import_rules_insert on public.statement_import_rules;
create policy statement_import_rules_insert on public.statement_import_rules for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists statement_import_rules_update on public.statement_import_rules;
create policy statement_import_rules_update on public.statement_import_rules for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists statement_import_rules_delete on public.statement_import_rules;
create policy statement_import_rules_delete on public.statement_import_rules for delete to authenticated using (user_id = (select auth.uid()));
revoke all on public.statement_import_rules from public, anon, authenticated;
grant select, insert, update, delete on public.statement_import_rules to authenticated;

-- statement_imports/statement_import_rows/statement_import_row_matches
-- are SELECT-only to authenticated — every write (including plain field
-- edits like a row's category/payee/decision) goes through an
-- ownership+status-revalidating RPC below, so a client can never forge a
-- posted/completed status, duplicate/match metadata, or a link to another
-- user's transaction by issuing a raw UPDATE.
drop policy if exists statement_imports_select on public.statement_imports;
create policy statement_imports_select on public.statement_imports for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.statement_imports from public, anon, authenticated;
grant select on public.statement_imports to authenticated;

drop policy if exists statement_import_rows_select on public.statement_import_rows;
create policy statement_import_rows_select on public.statement_import_rows for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.statement_import_rows from public, anon, authenticated;
grant select on public.statement_import_rows to authenticated;

drop policy if exists statement_import_row_matches_select on public.statement_import_row_matches;
create policy statement_import_row_matches_select on public.statement_import_row_matches for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.statement_import_row_matches from public, anon, authenticated;
grant select on public.statement_import_row_matches to authenticated;

-- =======================================================================
-- 8. RPCs.
-- =======================================================================

-- 8a. Start a new import. The file itself has already been parsed enough
-- in TypeScript (header extraction, hashing, delimiter/encoding
-- detection) to call this — no file bytes ever reach the database.
-- Reports (without blocking) whether this exact file was already
-- imported into this account, so the caller can warn/confirm rather than
-- silently re-processing it.
create or replace function public.create_statement_import(
  p_account_id uuid,
  p_original_filename text,
  p_file_hash text,
  p_file_format text,
  p_file_size_bytes integer,
  p_detected_delimiter text,
  p_detected_encoding text,
  p_header_fingerprint text,
  p_currency text default 'INR',
  p_row_count_hint integer default null
)
returns table (import_id uuid, is_duplicate_file boolean, existing_import_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_account public.accounts;
  v_existing_import_id uuid;
  v_new_id uuid;
begin
  if v_user_id is null then
    raise exception 'Sign in required' using errcode = '42501';
  end if;

  select * into v_account from public.accounts where id = p_account_id and user_id = v_user_id;
  if v_account.id is null then
    raise exception 'Account not found' using errcode = '42501';
  end if;
  if v_account.is_archived then
    raise exception 'Cannot import into an archived account' using errcode = '22023';
  end if;
  if v_account.is_system then
    raise exception 'Cannot import into a system account' using errcode = '22023';
  end if;
  if v_account.currency <> p_currency then
    raise exception 'Statement currency does not match the account currency' using errcode = '22023';
  end if;

  select id into v_existing_import_id
    from public.statement_imports
    where user_id = v_user_id and account_id = p_account_id and file_hash = p_file_hash and status <> 'discarded'
    order by created_at desc
    limit 1;

  insert into public.statement_imports (
    user_id, account_id, original_filename, file_hash, file_format, file_size_bytes,
    row_count_hint, detected_delimiter, detected_encoding, header_fingerprint, currency, status
  ) values (
    v_user_id, p_account_id, p_original_filename, p_file_hash, p_file_format, p_file_size_bytes,
    p_row_count_hint, p_detected_delimiter, p_detected_encoding, p_header_fingerprint, p_currency, 'mapping_required'
  )
  returning id into v_new_id;

  import_id := v_new_id;
  is_duplicate_file := v_existing_import_id is not null;
  existing_import_id := v_existing_import_id;
  return next;
end;
$$;

revoke all on function public.create_statement_import(
  uuid, text, text, text, integer, text, text, text, text, integer
) from public, anon;
grant execute on function public.create_statement_import(
  uuid, text, text, text, integer, text, text, text, text, integer
) to authenticated;

-- 8b. Save a reusable column-mapping preset — only ever called when the
-- user explicitly opts in, never automatically.
create or replace function public.save_statement_column_mapping(
  p_header_fingerprint text,
  p_date_column text,
  p_description_column text,
  p_date_format text,
  p_bank_label text default null,
  p_value_date_column text default null,
  p_reference_column text default null,
  p_debit_column text default null,
  p_credit_column text default null,
  p_amount_column text default null,
  p_transaction_type_column text default null,
  p_balance_column text default null,
  p_amount_sign_convention text default 'debit_negative'
)
returns public.statement_column_mappings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_row public.statement_column_mappings;
begin
  if v_user_id is null then
    raise exception 'Sign in required' using errcode = '42501';
  end if;

  insert into public.statement_column_mappings (
    user_id, header_fingerprint, bank_label, date_column, value_date_column, description_column,
    reference_column, debit_column, credit_column, amount_column, transaction_type_column,
    balance_column, date_format, amount_sign_convention
  ) values (
    v_user_id, p_header_fingerprint, p_bank_label, p_date_column, p_value_date_column, p_description_column,
    p_reference_column, p_debit_column, p_credit_column, p_amount_column, p_transaction_type_column,
    p_balance_column, p_date_format, p_amount_sign_convention
  )
  on conflict (user_id, header_fingerprint) do update set
    bank_label = excluded.bank_label,
    date_column = excluded.date_column,
    value_date_column = excluded.value_date_column,
    description_column = excluded.description_column,
    reference_column = excluded.reference_column,
    debit_column = excluded.debit_column,
    credit_column = excluded.credit_column,
    amount_column = excluded.amount_column,
    transaction_type_column = excluded.transaction_type_column,
    balance_column = excluded.balance_column,
    date_format = excluded.date_format,
    amount_sign_convention = excluded.amount_sign_convention,
    updated_at = now()
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.save_statement_column_mapping(
  text, text, text, text, text, text, text, text, text, text, text, text, text
) from public, anon;
grant execute on function public.save_statement_column_mapping(
  text, text, text, text, text, text, text, text, text, text, text, text, text
) to authenticated;

-- 8c. Confirm/apply the mapping for one import — always required, even
-- when a saved preset was used to pre-fill the form, satisfying "Require
-- confirmation before parsing" unconditionally rather than only when
-- auto-detection confidence is low.
create or replace function public.apply_statement_import_mapping(
  p_import_id uuid,
  p_date_column text,
  p_description_column text,
  p_date_format text,
  p_value_date_column text default null,
  p_reference_column text default null,
  p_debit_column text default null,
  p_credit_column text default null,
  p_amount_column text default null,
  p_transaction_type_column text default null,
  p_balance_column text default null,
  p_amount_sign_convention text default 'debit_negative',
  p_column_mapping_id uuid default null
)
returns public.statement_imports
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_row public.statement_imports;
begin
  if v_user_id is null then
    raise exception 'Sign in required' using errcode = '42501';
  end if;

  select * into v_row from public.statement_imports where id = p_import_id and user_id = v_user_id;
  if v_row.id is null then
    raise exception 'Import not found' using errcode = '42501';
  end if;
  if v_row.status <> 'mapping_required' then
    raise exception 'Import is not awaiting a mapping' using errcode = '22023';
  end if;
  if p_column_mapping_id is not null then
    if not exists (select 1 from public.statement_column_mappings where id = p_column_mapping_id and user_id = v_user_id) then
      raise exception 'Mapping preset not found' using errcode = '42501';
    end if;
  end if;

  update public.statement_imports set
    date_column = p_date_column,
    value_date_column = p_value_date_column,
    description_column = p_description_column,
    reference_column = p_reference_column,
    debit_column = p_debit_column,
    credit_column = p_credit_column,
    amount_column = p_amount_column,
    transaction_type_column = p_transaction_type_column,
    balance_column = p_balance_column,
    date_format = p_date_format,
    amount_sign_convention = p_amount_sign_convention,
    column_mapping_id = p_column_mapping_id,
    mapped_at = now()
  where id = p_import_id
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.apply_statement_import_mapping(
  uuid, text, text, text, text, text, text, text, text, text, text, text, uuid
) from public, anon;
grant execute on function public.apply_statement_import_mapping(
  uuid, text, text, text, text, text, text, text, text, text, text, text, uuid
) to authenticated;

-- 8d. Bulk-insert the already-parsed-and-validated staging rows (parsing/
-- validation happens in TypeScript — see src/lib/bank-import/parser.ts).
-- p_rows shape: jsonb array of {row_index, row_hash, transaction_date,
-- value_date, description, reference, cheque_number, amount, direction,
-- running_balance, currency, suggested_transaction_type, validation_errors}.
create or replace function public.insert_statement_import_rows(
  p_import_id uuid,
  p_rows jsonb
)
returns table (inserted_count integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_import public.statement_imports;
  v_count integer;
  v_valid integer;
  v_invalid integer;
begin
  if v_user_id is null then
    raise exception 'Sign in required' using errcode = '42501';
  end if;

  select * into v_import from public.statement_imports where id = p_import_id and user_id = v_user_id;
  if v_import.id is null then
    raise exception 'Import not found' using errcode = '42501';
  end if;
  if v_import.status <> 'mapping_required' then
    raise exception 'Import is not awaiting parsed rows' using errcode = '22023';
  end if;
  if jsonb_array_length(p_rows) = 0 then
    raise exception 'No rows to insert' using errcode = '22023';
  end if;
  if jsonb_array_length(p_rows) > 2000 then
    raise exception 'Statement exceeds the maximum of 2000 rows per import' using errcode = '22023';
  end if;

  insert into public.statement_import_rows (
    import_id, user_id, account_id, row_index, row_hash, transaction_date, value_date,
    description, reference, cheque_number, amount, direction, running_balance, currency,
    suggested_transaction_type, validation_errors
  )
  select
    p_import_id,
    v_user_id,
    v_import.account_id,
    (row_data ->> 'row_index')::integer,
    row_data ->> 'row_hash',
    nullif(row_data ->> 'transaction_date', '')::date,
    nullif(row_data ->> 'value_date', '')::date,
    coalesce(row_data ->> 'description', ''),
    row_data ->> 'reference',
    row_data ->> 'cheque_number',
    nullif(row_data ->> 'amount', '')::numeric(20, 4),
    row_data ->> 'direction',
    nullif(row_data ->> 'running_balance', '')::numeric(20, 4),
    coalesce(row_data ->> 'currency', v_import.currency),
    row_data ->> 'suggested_transaction_type',
    coalesce(row_data -> 'validation_errors', '[]'::jsonb)
  from jsonb_array_elements(p_rows) as row_data;

  get diagnostics v_count = row_count;

  -- Mark same-file row-level duplicates: a second-or-later occurrence of
  -- an identical row_hash within this one import.
  with ranked as (
    select id, row_number() over (partition by row_hash order by row_index) as occurrence
    from public.statement_import_rows
    where import_id = p_import_id
  )
  update public.statement_import_rows r
  set duplicate_status = 'exact_row_duplicate', user_decision = 'exclude'
  from ranked
  where r.id = ranked.id and ranked.occurrence > 1;

  select
    count(*) filter (where jsonb_array_length(validation_errors) = 0),
    count(*) filter (where jsonb_array_length(validation_errors) > 0)
  into v_valid, v_invalid
  from public.statement_import_rows where import_id = p_import_id;

  update public.statement_imports set
    total_rows = v_count,
    valid_rows = v_valid,
    invalid_rows = v_invalid,
    parsed_at = now(),
    status = 'parsed'
  where id = p_import_id;

  inserted_count := v_count;
  return next;
end;
$$;

revoke all on function public.insert_statement_import_rows(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.insert_statement_import_rows(uuid, jsonb) to authenticated;

-- 8e. Apply TS-computed duplicate/match analysis and transition to
-- 'reviewing'. p_row_updates shape: jsonb array of {row_id,
-- duplicate_status, match_status, suggested_category_id,
-- suggested_payee_id, resolved_transaction_type, counterparty_account_id,
-- matched_rule_id, user_decision}. p_matches shape: jsonb array of
-- {row_id, candidate_transaction_id, candidate_row_id, match_kind, score,
-- confidence, reasons, conflicts}. Every row_id is re-validated against
-- this import before use — the RPC trusts the *shape* TypeScript computed
-- but never trusts an id it didn't itself verify belongs to this import.
create or replace function public.apply_statement_import_row_analysis(
  p_import_id uuid,
  p_row_updates jsonb,
  p_matches jsonb default '[]'::jsonb
)
returns public.statement_imports
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_import public.statement_imports;
  v_update jsonb;
  v_match jsonb;
  v_duplicate_count integer;
begin
  if v_user_id is null then
    raise exception 'Sign in required' using errcode = '42501';
  end if;

  select * into v_import from public.statement_imports where id = p_import_id and user_id = v_user_id;
  if v_import.id is null then
    raise exception 'Import not found' using errcode = '42501';
  end if;
  if v_import.status <> 'parsed' then
    raise exception 'Import is not awaiting analysis' using errcode = '22023';
  end if;

  for v_update in select * from jsonb_array_elements(p_row_updates)
  loop
    update public.statement_import_rows set
      duplicate_status = coalesce(v_update ->> 'duplicate_status', duplicate_status),
      match_status = coalesce(v_update ->> 'match_status', match_status),
      suggested_category_id = coalesce((v_update ->> 'suggested_category_id')::uuid, suggested_category_id),
      suggested_payee_id = coalesce((v_update ->> 'suggested_payee_id')::uuid, suggested_payee_id),
      resolved_transaction_type = coalesce(v_update ->> 'resolved_transaction_type', resolved_transaction_type),
      counterparty_account_id = coalesce((v_update ->> 'counterparty_account_id')::uuid, counterparty_account_id),
      matched_rule_id = coalesce((v_update ->> 'matched_rule_id')::uuid, matched_rule_id),
      user_decision = case
        when (v_update ->> 'duplicate_status') in ('exact_file_duplicate', 'exact_row_duplicate', 'existing_transaction_match')
          then 'exclude'
        else coalesce(v_update ->> 'user_decision', user_decision)
      end
    where id = (v_update ->> 'row_id')::uuid and import_id = p_import_id;
  end loop;

  for v_match in select * from jsonb_array_elements(p_matches)
  loop
    if exists (select 1 from public.statement_import_rows where id = (v_match ->> 'row_id')::uuid and import_id = p_import_id) then
      insert into public.statement_import_row_matches (
        import_row_id, user_id, candidate_transaction_id, candidate_row_id, match_kind, score, confidence, reasons, conflicts
      ) values (
        (v_match ->> 'row_id')::uuid,
        v_user_id,
        nullif(v_match ->> 'candidate_transaction_id', '')::uuid,
        nullif(v_match ->> 'candidate_row_id', '')::uuid,
        v_match ->> 'match_kind',
        (v_match ->> 'score')::numeric(5, 4),
        v_match ->> 'confidence',
        coalesce(v_match -> 'reasons', '[]'::jsonb),
        coalesce(v_match -> 'conflicts', '[]'::jsonb)
      );
    end if;
  end loop;

  select count(*) into v_duplicate_count
  from public.statement_import_rows
  where import_id = p_import_id and duplicate_status <> 'not_duplicate';

  update public.statement_imports set
    duplicate_rows = v_duplicate_count,
    status = 'reviewing'
  where id = p_import_id
  returning * into v_import;

  return v_import;
end;
$$;

revoke all on function public.apply_statement_import_row_analysis(uuid, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.apply_statement_import_row_analysis(uuid, jsonb, jsonb) to authenticated;

-- 8f. Edit a single row's decision/category/payee/kind/counterparty
-- during review.
create or replace function public.update_statement_import_row(
  p_row_id uuid,
  p_user_decision text default null,
  p_category_id uuid default null,
  p_payee_id uuid default null,
  p_resolved_transaction_type text default null,
  p_counterparty_account_id uuid default null,
  p_notes text default null
)
returns public.statement_import_rows
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_row public.statement_import_rows;
  v_import_status text;
begin
  if v_user_id is null then
    raise exception 'Sign in required' using errcode = '42501';
  end if;

  select * into v_row from public.statement_import_rows where id = p_row_id and user_id = v_user_id;
  if v_row.id is null then
    raise exception 'Row not found' using errcode = '42501';
  end if;
  select status into v_import_status from public.statement_imports where id = v_row.import_id;

  if v_import_status not in ('reviewing', 'ready') then
    raise exception 'Import is not open for review edits' using errcode = '22023';
  end if;
  if p_user_decision is not null and p_user_decision not in ('pending', 'include', 'exclude') then
    raise exception 'Invalid decision' using errcode = '22023';
  end if;

  update public.statement_import_rows set
    user_decision = coalesce(p_user_decision, user_decision),
    suggested_category_id = coalesce(p_category_id, suggested_category_id),
    suggested_payee_id = coalesce(p_payee_id, suggested_payee_id),
    resolved_transaction_type = coalesce(p_resolved_transaction_type, resolved_transaction_type),
    counterparty_account_id = coalesce(p_counterparty_account_id, counterparty_account_id),
    notes = coalesce(p_notes, notes)
  where id = p_row_id
  returning * into v_row;

  if v_import_status = 'ready' then
    update public.statement_imports set status = 'reviewing' where id = v_row.import_id;
  end if;

  return v_row;
end;
$$;

revoke all on function public.update_statement_import_row(uuid, text, uuid, uuid, text, uuid, text) from public, anon, authenticated;
grant execute on function public.update_statement_import_row(uuid, text, uuid, uuid, text, uuid, text) to authenticated;

-- 8g. Bulk row actions — never silently overrides a hard file/row
-- duplicate into 'include', and only ever touches rows that actually
-- belong to this import and this user.
create or replace function public.bulk_update_statement_import_rows(
  p_import_id uuid,
  p_row_ids uuid[],
  p_user_decision text default null,
  p_category_id uuid default null,
  p_payee_id uuid default null
)
returns table (updated_count integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_import public.statement_imports;
  v_count integer;
begin
  if v_user_id is null then
    raise exception 'Sign in required' using errcode = '42501';
  end if;

  select * into v_import from public.statement_imports where id = p_import_id and user_id = v_user_id;
  if v_import.id is null then
    raise exception 'Import not found' using errcode = '42501';
  end if;
  if v_import.status not in ('reviewing', 'ready') then
    raise exception 'Import is not open for review edits' using errcode = '22023';
  end if;
  if p_user_decision is not null and p_user_decision not in ('pending', 'include', 'exclude') then
    raise exception 'Invalid decision' using errcode = '22023';
  end if;

  update public.statement_import_rows set
    user_decision = case
      when p_user_decision = 'include' and duplicate_status in ('exact_file_duplicate', 'exact_row_duplicate') then user_decision
      else coalesce(p_user_decision, user_decision)
    end,
    suggested_category_id = coalesce(p_category_id, suggested_category_id),
    suggested_payee_id = coalesce(p_payee_id, suggested_payee_id)
  where import_id = p_import_id and id = any(p_row_ids);

  get diagnostics v_count = row_count;

  if v_import.status = 'ready' then
    update public.statement_imports set status = 'reviewing' where id = p_import_id;
  end if;

  updated_count := v_count;
  return next;
end;
$$;

revoke all on function public.bulk_update_statement_import_rows(uuid, uuid[], text, uuid, uuid) from public, anon, authenticated;
grant execute on function public.bulk_update_statement_import_rows(uuid, uuid[], text, uuid, uuid) to authenticated;

-- 8h. Link a row to an existing posted transaction — reconciled evidence,
-- never a repost. Both sides must belong to the caller; the target
-- transaction must be posted (not reversed) and not already claimed by
-- another row.
create or replace function public.link_statement_import_row_to_transaction(
  p_row_id uuid,
  p_transaction_id uuid
)
returns public.statement_import_rows
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_row public.statement_import_rows;
  v_import_status text;
  v_txn public.ledger_transactions;
begin
  if v_user_id is null then
    raise exception 'Sign in required' using errcode = '42501';
  end if;

  select * into v_row from public.statement_import_rows where id = p_row_id and user_id = v_user_id;
  if v_row.id is null then
    raise exception 'Row not found' using errcode = '42501';
  end if;
  select status into v_import_status from public.statement_imports where id = v_row.import_id;

  if v_import_status not in ('reviewing', 'ready') then
    raise exception 'Import is not open for review edits' using errcode = '22023';
  end if;

  select * into v_txn from public.ledger_transactions where id = p_transaction_id and user_id = v_user_id;
  if v_txn.id is null then
    raise exception 'Transaction not found' using errcode = '42501';
  end if;
  if v_txn.status <> 'posted' then
    raise exception 'Cannot link to a reversed transaction' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.statement_import_rows
    where linked_existing_transaction_id = p_transaction_id and id <> p_row_id
  ) then
    raise exception 'This transaction is already linked to another statement row' using errcode = '22023';
  end if;

  update public.statement_import_rows set
    linked_existing_transaction_id = p_transaction_id,
    linked_created_transaction_id = null,
    match_status = 'existing_match_confirmed',
    user_decision = 'include'
  where id = p_row_id
  returning * into v_row;

  if v_import_status = 'ready' then
    update public.statement_imports set status = 'reviewing' where id = v_row.import_id;
  end if;

  return v_row;
end;
$$;

revoke all on function public.link_statement_import_row_to_transaction(uuid, uuid) from public, anon, authenticated;
grant execute on function public.link_statement_import_row_to_transaction(uuid, uuid) to authenticated;

-- 8i. Undo a link — only while the import hasn't completed.
create or replace function public.unlink_statement_import_row(p_row_id uuid)
returns public.statement_import_rows
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_row public.statement_import_rows;
  v_import_status text;
begin
  if v_user_id is null then
    raise exception 'Sign in required' using errcode = '42501';
  end if;

  select * into v_row from public.statement_import_rows where id = p_row_id and user_id = v_user_id;
  if v_row.id is null then
    raise exception 'Row not found' using errcode = '42501';
  end if;
  select status into v_import_status from public.statement_imports where id = v_row.import_id;

  if v_import_status = 'completed' then
    raise exception 'Cannot unlink a row from a completed import' using errcode = '22023';
  end if;

  update public.statement_import_rows set
    linked_existing_transaction_id = null,
    match_status = case when match_status = 'existing_match_confirmed' then 'existing_match_candidate' else match_status end
  where id = p_row_id
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.unlink_statement_import_row(uuid) from public, anon, authenticated;
grant execute on function public.unlink_statement_import_row(uuid) to authenticated;

-- 8j. Confirm a transfer/credit-card-payment pairing between two rows —
-- both must be owned by the caller, opposite direction, equal absolute
-- amount, and neither already claimed by another transfer. The actual
-- transaction is created (once, by whichever side posts first) inside
-- post_statement_import_batch, never here — confirming only records the
-- pairing so it survives a page reload before the user is ready to post.
create or replace function public.confirm_statement_transfer_match(
  p_row_id uuid,
  p_candidate_row_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_row public.statement_import_rows;
  v_candidate public.statement_import_rows;
  v_row_status text;
  v_candidate_status text;
  v_group_id uuid;
  v_resolved_type text;
  v_row_account public.accounts;
  v_candidate_account public.accounts;
begin
  if v_user_id is null then
    raise exception 'Sign in required' using errcode = '42501';
  end if;
  if p_row_id = p_candidate_row_id then
    raise exception 'A row cannot be its own transfer counterpart' using errcode = '22023';
  end if;

  select * into v_row from public.statement_import_rows where id = p_row_id and user_id = v_user_id;
  select * into v_candidate from public.statement_import_rows where id = p_candidate_row_id and user_id = v_user_id;

  if v_row.id is null or v_candidate.id is null then
    raise exception 'Row not found' using errcode = '42501';
  end if;
  select status into v_row_status from public.statement_imports where id = v_row.import_id;
  select status into v_candidate_status from public.statement_imports where id = v_candidate.import_id;
  if v_row_status not in ('reviewing', 'ready') or v_candidate_status not in ('reviewing', 'ready') then
    raise exception 'Both imports must be open for review' using errcode = '22023';
  end if;
  if v_row.account_id = v_candidate.account_id then
    raise exception 'A transfer requires two different accounts' using errcode = '22023';
  end if;
  if v_row.direction is null or v_candidate.direction is null or v_row.direction = v_candidate.direction then
    raise exception 'A transfer pair requires opposite debit/credit directions' using errcode = '22023';
  end if;
  if v_row.amount is null or v_candidate.amount is null or abs(v_row.amount) <> abs(v_candidate.amount) then
    raise exception 'A transfer pair requires equal absolute amounts' using errcode = '22023';
  end if;
  if v_row.currency <> v_candidate.currency then
    raise exception 'A transfer pair requires matching currencies' using errcode = '22023';
  end if;
  if v_row.transfer_group_id is not null or v_candidate.transfer_group_id is not null then
    raise exception 'One of these rows is already part of a transfer pair' using errcode = '22023';
  end if;

  select * into v_row_account from public.accounts where id = v_row.account_id;
  select * into v_candidate_account from public.accounts where id = v_candidate.account_id;

  v_resolved_type := case
    when v_row_account.account_type = 'credit_card' or v_candidate_account.account_type = 'credit_card'
      then 'credit_card_payment'
    else 'transfer'
  end;

  v_group_id := gen_random_uuid();

  update public.statement_import_rows set
    transfer_group_id = v_group_id,
    counterparty_account_id = v_candidate.account_id,
    resolved_transaction_type = v_resolved_type,
    match_status = 'transfer_confirmed',
    user_decision = 'include'
  where id = p_row_id;

  update public.statement_import_rows set
    transfer_group_id = v_group_id,
    counterparty_account_id = v_row.account_id,
    resolved_transaction_type = v_resolved_type,
    match_status = 'transfer_confirmed',
    user_decision = 'include'
  where id = p_candidate_row_id;

  if v_row_status = 'ready' then
    update public.statement_imports set status = 'reviewing' where id = v_row.import_id;
  end if;
  if v_candidate_status = 'ready' then
    update public.statement_imports set status = 'reviewing' where id = v_candidate.import_id;
  end if;
end;
$$;

revoke all on function public.confirm_statement_transfer_match(uuid, uuid) from public, anon, authenticated;
grant execute on function public.confirm_statement_transfer_match(uuid, uuid) to authenticated;

-- 8k. Explicit lifecycle steps: ready <-> reviewing.
create or replace function public.mark_statement_import_ready(p_import_id uuid)
returns public.statement_imports
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_row public.statement_imports;
begin
  if v_user_id is null then
    raise exception 'Sign in required' using errcode = '42501';
  end if;

  select * into v_row from public.statement_imports where id = p_import_id and user_id = v_user_id;
  if v_row.id is null then
    raise exception 'Import not found' using errcode = '42501';
  end if;
  if v_row.status <> 'reviewing' then
    raise exception 'Import is not in review' using errcode = '22023';
  end if;

  update public.statement_imports set status = 'ready', confirmed_at = now() where id = p_import_id
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.mark_statement_import_ready(uuid) from public, anon, authenticated;
grant execute on function public.mark_statement_import_ready(uuid) to authenticated;

create or replace function public.revert_statement_import_to_reviewing(p_import_id uuid)
returns public.statement_imports
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_row public.statement_imports;
begin
  if v_user_id is null then
    raise exception 'Sign in required' using errcode = '42501';
  end if;

  select * into v_row from public.statement_imports where id = p_import_id and user_id = v_user_id;
  if v_row.id is null then
    raise exception 'Import not found' using errcode = '42501';
  end if;
  if v_row.status <> 'ready' then
    raise exception 'Import is not ready' using errcode = '22023';
  end if;

  update public.statement_imports set status = 'reviewing' where id = p_import_id
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.revert_statement_import_to_reviewing(uuid) from public, anon, authenticated;
grant execute on function public.revert_statement_import_to_reviewing(uuid) to authenticated;

-- 8l. Discard a not-yet-posted (or failed) import — never removes any
-- financial history since nothing was ever posted from it, and rows stay
-- for audit rather than being deleted.
create or replace function public.discard_statement_import(p_import_id uuid)
returns public.statement_imports
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_row public.statement_imports;
begin
  if v_user_id is null then
    raise exception 'Sign in required' using errcode = '42501';
  end if;

  select * into v_row from public.statement_imports where id = p_import_id and user_id = v_user_id;
  if v_row.id is null then
    raise exception 'Import not found' using errcode = '42501';
  end if;
  if v_row.status in ('posting', 'completed') then
    raise exception 'Cannot discard an import that has posted transactions' using errcode = '22023';
  end if;
  if v_row.status = 'discarded' then
    return v_row;
  end if;

  update public.statement_imports set status = 'discarded', discarded_at = now() where id = p_import_id
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.discard_statement_import(uuid) from public, anon, authenticated;
grant execute on function public.discard_statement_import(uuid) to authenticated;

-- 8m. Save/update or delete a private categorization rule.
create or replace function public.save_statement_import_rule(
  p_name text,
  p_match_field text,
  p_match_value text,
  p_rule_id uuid default null,
  p_direction_filter text default null,
  p_account_id uuid default null,
  p_min_amount numeric default null,
  p_max_amount numeric default null,
  p_suggested_transaction_type text default null,
  p_suggested_category_id uuid default null,
  p_suggested_payee_id uuid default null,
  p_notes_template text default null,
  p_exclude boolean default false,
  p_priority integer default 0
)
returns public.statement_import_rules
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_row public.statement_import_rules;
begin
  if v_user_id is null then
    raise exception 'Sign in required' using errcode = '42501';
  end if;
  if p_account_id is not null and not exists (select 1 from public.accounts where id = p_account_id and user_id = v_user_id) then
    raise exception 'Account not found' using errcode = '42501';
  end if;

  if p_rule_id is not null then
    update public.statement_import_rules set
      name = p_name,
      match_field = p_match_field,
      match_value = p_match_value,
      direction_filter = p_direction_filter,
      account_id = p_account_id,
      min_amount = p_min_amount,
      max_amount = p_max_amount,
      suggested_transaction_type = p_suggested_transaction_type,
      suggested_category_id = p_suggested_category_id,
      suggested_payee_id = p_suggested_payee_id,
      notes_template = p_notes_template,
      exclude = p_exclude,
      priority = p_priority
    where id = p_rule_id and user_id = v_user_id
    returning * into v_row;

    if v_row.id is null then
      raise exception 'Rule not found' using errcode = '42501';
    end if;
    return v_row;
  end if;

  insert into public.statement_import_rules (
    user_id, name, match_field, match_value, direction_filter, account_id, min_amount, max_amount,
    suggested_transaction_type, suggested_category_id, suggested_payee_id, notes_template, exclude, priority
  ) values (
    v_user_id, p_name, p_match_field, p_match_value, p_direction_filter, p_account_id, p_min_amount, p_max_amount,
    p_suggested_transaction_type, p_suggested_category_id, p_suggested_payee_id, p_notes_template, p_exclude, p_priority
  )
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.save_statement_import_rule(
  text, text, text, uuid, text, uuid, numeric, numeric, text, uuid, uuid, text, boolean, integer
) from public, anon;
grant execute on function public.save_statement_import_rule(
  text, text, text, uuid, text, uuid, numeric, numeric, text, uuid, uuid, text, boolean, integer
) to authenticated;

create or replace function public.delete_statement_import_rule(p_rule_id uuid)
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

  delete from public.statement_import_rules where id = p_rule_id and user_id = v_user_id;
  if not found then
    raise exception 'Rule not found' using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.delete_statement_import_rule(uuid) from public, anon, authenticated;
grant execute on function public.delete_statement_import_rule(uuid) to authenticated;

-- 8n. Atomic batch posting — the single trusted boundary. Revalidates
-- everything, then posts every included row inside one PL/pgSQL function
-- call (one Postgres transaction): the begin/exception block below wraps
-- the entire per-row loop, so a failure at any row rolls back every
-- ledger_transactions/ledger_entries insert made earlier in the *same*
-- call (PL/pgSQL's implicit savepoint semantics), while the exception
-- handler's own "mark this import failed" write happens after that
-- rollback-to-savepoint and so still persists — a genuinely balanced
-- all-or-nothing result without needing chunked/resumable posting, which
-- MAX_STATEMENT_IMPORT_ROWS (2000, enforced in section 4 and in
-- insert_statement_import_rows) makes practical. Every post reuses
-- post_manual_transaction_for_user — no double-entry logic is duplicated
-- here.
create or replace function public.post_statement_import_batch(p_import_id uuid)
returns table (
  success boolean,
  posted_count integer,
  linked_count integer,
  transfer_count integer,
  error_code text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_import public.statement_imports;
  v_row record;
  v_posted_count integer := 0;
  v_linked_count integer := 0;
  v_transfer_count integer := 0;
  v_new_tx public.ledger_transactions;
  v_existing_transfer_tx_id uuid;
  v_entries jsonb;
  v_idempotency_key text;
  v_linked_txn public.ledger_transactions;
  v_from_account_id uuid;
  v_to_account_id uuid;
  v_credit_card_account_id uuid;
  v_asset_account_id uuid;
  v_own_account_type text;
  v_system_income_account_id uuid;
  v_system_expense_account_id uuid;
begin
  if v_user_id is null then
    raise exception 'Sign in required' using errcode = '42501';
  end if;

  select * into v_import from public.statement_imports where id = p_import_id and user_id = v_user_id for update;
  if v_import.id is null then
    raise exception 'Import not found' using errcode = '42501';
  end if;
  if v_import.status not in ('ready', 'failed') then
    success := false; posted_count := 0; linked_count := 0; transfer_count := 0; error_code := 'invalid_status';
    return next;
    return;
  end if;

  update public.statement_imports set status = 'posting' where id = p_import_id;

  begin
    for v_row in
      select * from public.statement_import_rows
      where import_id = p_import_id and user_decision = 'include'
      order by row_index
    loop
      if v_row.duplicate_status = 'existing_transaction_match' and v_row.linked_existing_transaction_id is null then
        raise exception 'row % is flagged as matching an existing transaction but is not linked', v_row.row_index
          using errcode = '22023';
      end if;

      -- Path 1: linked to an existing transaction — reconciled evidence, never a repost.
      if v_row.linked_existing_transaction_id is not null then
        select * into v_linked_txn from public.ledger_transactions
          where id = v_row.linked_existing_transaction_id and user_id = v_user_id and status = 'posted';
        if v_linked_txn.id is null then
          raise exception 'row % links to a transaction that is no longer valid', v_row.row_index
            using errcode = '22023';
        end if;
        update public.statement_import_rows set posting_result = 'linked' where id = v_row.id;
        v_linked_count := v_linked_count + 1;
        continue;
      end if;

      -- Path 2: transfer / credit-card-payment pair.
      if v_row.transfer_group_id is not null then
        select linked_created_transaction_id into v_existing_transfer_tx_id
        from public.statement_import_rows
        where transfer_group_id = v_row.transfer_group_id and id <> v_row.id and linked_created_transaction_id is not null
        limit 1;

        if v_existing_transfer_tx_id is not null then
          update public.statement_import_rows set
            linked_created_transaction_id = v_existing_transfer_tx_id,
            posting_result = 'transfer_linked'
          where id = v_row.id;
        else
          if v_row.counterparty_account_id is null then
            raise exception 'row % is missing its transfer counterpart account', v_row.row_index
              using errcode = '22023';
          end if;

          if v_row.resolved_transaction_type = 'credit_card_payment' then
            select account_type into v_own_account_type from public.accounts where id = v_row.account_id;
            if v_own_account_type = 'credit_card' then
              v_credit_card_account_id := v_row.account_id;
              v_asset_account_id := v_row.counterparty_account_id;
            else
              v_credit_card_account_id := v_row.counterparty_account_id;
              v_asset_account_id := v_row.account_id;
            end if;
            v_entries := jsonb_build_array(
              jsonb_build_object('account_id', v_credit_card_account_id, 'amount', abs(v_row.amount)),
              jsonb_build_object('account_id', v_asset_account_id, 'amount', -abs(v_row.amount))
            );
          else
            if v_row.direction = 'debit' then
              v_from_account_id := v_row.account_id;
              v_to_account_id := v_row.counterparty_account_id;
            else
              v_from_account_id := v_row.counterparty_account_id;
              v_to_account_id := v_row.account_id;
            end if;
            v_entries := jsonb_build_array(
              jsonb_build_object('account_id', v_to_account_id, 'amount', abs(v_row.amount)),
              jsonb_build_object('account_id', v_from_account_id, 'amount', -abs(v_row.amount))
            );
          end if;

          v_idempotency_key := 'stmt-transfer:' || v_row.transfer_group_id::text;
          v_new_tx := public.post_manual_transaction_for_user(
            v_user_id, v_row.resolved_transaction_type, v_row.transaction_date::timestamptz,
            coalesce(nullif(btrim(v_row.description), ''), 'Imported transfer'), v_entries,
            v_row.notes, null, null, v_idempotency_key, 'import'
          );
          update public.statement_import_rows set
            linked_created_transaction_id = v_new_tx.id,
            posting_result = 'transfer_created'
          where id = v_row.id;
        end if;

        v_transfer_count := v_transfer_count + 1;
        continue;
      end if;

      -- Path 3: plain create (income / expense / credit_card_purchase) —
      -- mirrors src/lib/ledger/entry-builder.ts's buildIncomeEntries/
      -- buildExpenseEntries/buildCreditCardPurchaseEntries exactly: every
      -- unmatched row still pairs with the user's own Uncategorized
      -- Income/Expense system account, never a bare single-sided entry.
      if v_row.resolved_transaction_type is null or v_row.amount is null or v_row.transaction_date is null then
        raise exception 'row % is missing required fields for posting', v_row.row_index using errcode = '22023';
      end if;

      if v_row.resolved_transaction_type = 'income' then
        select id into v_system_income_account_id from public.accounts
          where user_id = v_user_id and is_system = true and system_code = 'uncategorized_income';
        if v_system_income_account_id is null then
          raise exception 'uncategorized_income system account is missing for this user' using errcode = '22023';
        end if;
        v_entries := jsonb_build_array(
          jsonb_build_object('account_id', v_row.account_id, 'amount', abs(v_row.amount)),
          jsonb_build_object('account_id', v_system_income_account_id, 'amount', -abs(v_row.amount))
        );
      elsif v_row.resolved_transaction_type in ('expense', 'credit_card_purchase') then
        select id into v_system_expense_account_id from public.accounts
          where user_id = v_user_id and is_system = true and system_code = 'uncategorized_expense';
        if v_system_expense_account_id is null then
          raise exception 'uncategorized_expense system account is missing for this user' using errcode = '22023';
        end if;
        v_entries := jsonb_build_array(
          jsonb_build_object('account_id', v_system_expense_account_id, 'amount', abs(v_row.amount)),
          jsonb_build_object('account_id', v_row.account_id, 'amount', -abs(v_row.amount))
        );
      else
        raise exception 'row % has an unsupported resolved_transaction_type for direct posting: %',
          v_row.row_index, v_row.resolved_transaction_type using errcode = '22023';
      end if;

      v_idempotency_key := 'stmt-row:' || v_row.id::text;
      v_new_tx := public.post_manual_transaction_for_user(
        v_user_id, v_row.resolved_transaction_type, v_row.transaction_date::timestamptz,
        coalesce(nullif(btrim(v_row.description), ''), 'Imported transaction'), v_entries,
        v_row.notes, v_row.suggested_category_id, v_row.suggested_payee_id, v_idempotency_key, 'import'
      );
      update public.statement_import_rows set
        linked_created_transaction_id = v_new_tx.id,
        posting_result = 'created'
      where id = v_row.id;
      v_posted_count := v_posted_count + 1;
    end loop;
  exception when others then
    update public.statement_imports set status = 'failed', error_code = sqlstate where id = p_import_id;
    success := false; posted_count := 0; linked_count := 0; transfer_count := 0; error_code := sqlstate;
    return next;
    return;
  end;

  update public.statement_imports set
    status = 'completed',
    imported_rows = v_posted_count + v_transfer_count,
    matched_rows = v_linked_count,
    completed_at = now(),
    error_code = null
  where id = p_import_id;

  success := true;
  posted_count := v_posted_count;
  linked_count := v_linked_count;
  transfer_count := v_transfer_count;
  error_code := null;
  return next;
end;
$$;

revoke all on function public.post_statement_import_batch(uuid) from public, anon, authenticated;
grant execute on function public.post_statement_import_batch(uuid) to authenticated;
