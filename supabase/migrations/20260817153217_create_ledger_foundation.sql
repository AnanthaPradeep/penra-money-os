-- Phase 3: financial accounts and an auditable double-entry ledger.
--
-- Scope: institutions, a single ledger-account table (user-facing and
-- hidden system accounts), transaction headers, and immutable signed
-- entries. Every posted transaction must balance to zero across its
-- entries; balances are always derived from posted entries, never stored
-- as mutable state.
--
-- Sign convention: positive amount = debit, negative amount = credit.
-- No financial import, categorisation, budgets, investments, or dashboard
-- are introduced by this migration — see docs/phase-0 for the full roadmap.

-- =======================================================================
-- 1. public.institutions
-- =======================================================================

create table if not exists public.institutions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  institution_type text not null,
  website text null,
  notes text null,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint institutions_type_valid check (
    institution_type in ('bank', 'wallet', 'credit_union', 'broker', 'lender', 'other')
  ),
  constraint institutions_name_length check (
    char_length(btrim(name)) between 1 and 120
  ),
  constraint institutions_website_length check (
    website is null or char_length(website) <= 300
  ),
  constraint institutions_notes_length check (
    notes is null or char_length(notes) <= 2000
  )
);

comment on table public.institutions is
  'User-owned financial institutions (banks, wallets, brokers, lenders). '
  'No global catalogue — each user maintains their own list.';

-- =======================================================================
-- 2. public.accounts
-- =======================================================================
-- One ledger-account table for both user-facing accounts (bank, cash,
-- wallet, credit card, loan, other) and hidden system accounts
-- (opening-balance equity, uncategorised income/expense). System accounts
-- are provisioned only by public.provision_system_accounts() (section 6),
-- never directly by users — see the RLS insert policy in section 8.

create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  institution_id uuid null references public.institutions (id) on delete set null,
  name text not null,
  account_class text not null,
  account_type text not null,
  currency text not null default 'INR',
  last_four text null,
  credit_limit numeric(20, 4) null,
  system_code text null,
  is_system boolean not null default false,
  is_archived boolean not null default false,
  opened_on date null,
  closed_on date null,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint accounts_class_valid check (
    account_class in ('asset', 'liability', 'income', 'expense', 'equity')
  ),
  constraint accounts_type_valid check (
    account_type in (
      'bank_savings', 'bank_current', 'cash', 'wallet', 'credit_card', 'loan',
      'other_asset', 'other_liability',
      'opening_balance_equity', 'uncategorized_income', 'uncategorized_expense'
    )
  ),
  -- Account class and account type must be compatible (rule #4).
  constraint accounts_class_type_match check (
    (account_type in ('bank_savings', 'bank_current', 'cash', 'wallet', 'other_asset')
      and account_class = 'asset')
    or (account_type in ('credit_card', 'loan', 'other_liability')
      and account_class = 'liability')
    or (account_type = 'opening_balance_equity' and account_class = 'equity')
    or (account_type = 'uncategorized_income' and account_class = 'income')
    or (account_type = 'uncategorized_expense' and account_class = 'expense')
  ),
  constraint accounts_name_length check (
    char_length(btrim(name)) between 1 and 120
  ),
  -- Never a full card/account number — exactly four digits or nothing.
  constraint accounts_last_four_format check (
    last_four is null or last_four ~ '^[0-9]{4}$'
  ),
  constraint accounts_currency_format check (currency ~ '^[A-Z]{3}$'),
  -- credit_limit is allowed only for credit_card accounts, and must be
  -- positive when present (rule: "Credit limit must be positive when present").
  constraint accounts_credit_limit_scope check (
    credit_limit is null
    or (account_type = 'credit_card' and credit_limit > 0)
  ),
  -- System-account fields must be valid (rule #5): a system account always
  -- has a system_code and never an institution; a non-system account never
  -- has a system_code.
  constraint accounts_system_fields check (
    (is_system = false and system_code is null)
    or (is_system = true and system_code is not null and institution_id is null)
  ),
  constraint accounts_system_code_valid check (
    system_code is null
    or system_code in ('opening_balance_equity', 'uncategorized_income', 'uncategorized_expense')
  ),
  -- System accounts cannot be archived by the user (or anyone) — permanent.
  constraint accounts_system_not_archived check (not (is_system and is_archived)),
  constraint accounts_notes_length check (
    notes is null or char_length(notes) <= 2000
  ),
  constraint accounts_closed_after_opened check (
    closed_on is null or opened_on is null or closed_on >= opened_on
  )
);

comment on table public.accounts is
  'Ledger accounts: user-facing (bank/cash/wallet/credit_card/loan/other) '
  'and hidden system accounts (opening-balance equity, uncategorised '
  'income/expense). Balances are always derived from public.ledger_entries '
  '— this table never stores a mutable running balance.';

-- Enforce one system account per system_code per user (rule: "one account
-- per system_code per user"). Scoped to is_system = true, which the check
-- constraint above guarantees always has a non-null system_code.
create unique index if not exists accounts_one_system_account_per_user
  on public.accounts (user_id, system_code)
  where is_system = true;

-- =======================================================================
-- 3. public.ledger_transactions
-- =======================================================================

create table if not exists public.ledger_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  transaction_type text not null,
  status text not null default 'posted',
  occurred_at timestamptz not null,
  description text not null,
  notes text null,
  source_type text not null default 'manual',
  source_reference text null,
  reversal_of uuid null references public.ledger_transactions (id),
  reversed_by uuid null references public.ledger_transactions (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint ledger_transactions_type_valid check (
    transaction_type in (
      'opening_balance', 'income', 'expense', 'transfer',
      'credit_card_purchase', 'credit_card_payment', 'adjustment', 'reversal'
    )
  ),
  constraint ledger_transactions_status_valid check (status in ('posted', 'reversed')),
  constraint ledger_transactions_source_type_valid check (source_type in ('manual', 'system')),
  constraint ledger_transactions_description_length check (
    char_length(btrim(description)) between 1 and 200
  ),
  constraint ledger_transactions_notes_length check (
    notes is null or char_length(notes) <= 2000
  ),
  constraint ledger_transactions_source_reference_length check (
    source_reference is null or char_length(source_reference) <= 200
  ),
  -- A transaction cannot reverse itself.
  constraint ledger_transactions_no_self_reversal check (
    reversal_of is null or reversal_of <> id
  )
);

comment on table public.ledger_transactions is
  'Transaction headers for the double-entry ledger. Never physically '
  'deleted — a correction is made via reverse_transaction(), which creates '
  'a new linked reversal transaction and marks this one "reversed", '
  'preserving both for audit. source_reference is reserved for future '
  'import idempotency (Phase 4+); no importer exists yet.';

-- A given transaction can be the "original" for at most one reversal
-- (rule: "A transaction can be reversed only once" / "Prevent duplicate
-- concurrent reversals" — this unique index is the structural half of that
-- guarantee; public.reverse_transaction() adds the concurrency-safe
-- check-and-set half in section 7).
create unique index if not exists ledger_transactions_reversal_of_unique
  on public.ledger_transactions (reversal_of)
  where reversal_of is not null;

-- Reserved for future import idempotency (rule: "Prepare source_reference
-- for future import idempotency without implementing imports"). Scoped per
-- user since references are only meaningful within one user's data.
create unique index if not exists ledger_transactions_source_reference_unique
  on public.ledger_transactions (user_id, source_reference)
  where source_reference is not null;

-- =======================================================================
-- 4. public.ledger_entries
-- =======================================================================

create table if not exists public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  transaction_id uuid not null references public.ledger_transactions (id) on delete restrict,
  account_id uuid not null references public.accounts (id) on delete restrict,
  amount numeric(20, 4) not null,
  currency text not null default 'INR',
  memo text null,
  created_at timestamptz not null default now(),

  constraint ledger_entries_amount_nonzero check (amount <> 0),
  constraint ledger_entries_currency_format check (currency ~ '^[A-Z]{3}$'),
  constraint ledger_entries_memo_length check (
    memo is null or char_length(memo) <= 300
  )
);

comment on table public.ledger_entries is
  'Immutable, signed ledger entries. Positive = debit, negative = credit. '
  'Every entry belongs to exactly one transaction and one account; entries '
  'for a transaction must sum to exactly zero (enforced by a deferred '
  'constraint trigger — see section 5). `on delete restrict` on both '
  'foreign keys means a transaction or account with entries can never be '
  'deleted out from under its financial history.';

-- =======================================================================
-- 5. Cross-row validation: ownership + deferred balance check
-- =======================================================================

-- 5a. Per-row ownership/consistency validation for a new entry. Runs
-- immediately (not deferred) since it only needs to look at the single
-- referenced transaction and account, not sibling entries.
create or replace function public.validate_ledger_entry()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_txn_user_id uuid;
  v_acct_user_id uuid;
  v_acct_currency text;
begin
  select user_id into v_txn_user_id
    from public.ledger_transactions
    where id = new.transaction_id;

  if v_txn_user_id is null then
    raise exception 'ledger entry references a non-existent transaction'
      using errcode = 'foreign_key_violation';
  end if;

  if v_txn_user_id <> new.user_id then
    raise exception 'ledger entry user does not match transaction owner'
      using errcode = 'insufficient_privilege';
  end if;

  select user_id, currency into v_acct_user_id, v_acct_currency
    from public.accounts
    where id = new.account_id;

  if v_acct_user_id is null then
    raise exception 'ledger entry references a non-existent account'
      using errcode = 'foreign_key_violation';
  end if;

  if v_acct_user_id <> new.user_id then
    raise exception 'ledger entry user does not match account owner'
      using errcode = 'insufficient_privilege';
  end if;

  if v_acct_currency <> new.currency then
    raise exception 'ledger entry currency does not match account currency'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

revoke all on function public.validate_ledger_entry() from public, anon, authenticated;

drop trigger if exists ledger_entries_validate_ownership on public.ledger_entries;
create trigger ledger_entries_validate_ownership
  before insert on public.ledger_entries
  for each row
  execute function public.validate_ledger_entry();

-- 5b. Cross-row balance check: at least two entries, entries sum exactly
-- to zero, and every entry for the transaction uses the same currency.
-- Implemented as a DEFERRED constraint trigger (not a plain CHECK
-- constraint, which cannot see sibling rows) so that every entry in a
-- transaction can be inserted first, with the check running once at
-- commit time — see the atomic functions in section 7, which insert a
-- header and all of its entries within a single function call/transaction.
create or replace function public.check_ledger_transaction_balance()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_transaction_id uuid;
  v_entry_count int;
  v_balance_sum numeric(20, 4);
  v_currency_count int;
begin
  if TG_OP = 'DELETE' then
    v_transaction_id := old.transaction_id;
  else
    v_transaction_id := new.transaction_id;
  end if;

  select count(*), coalesce(sum(amount), 0), count(distinct currency)
    into v_entry_count, v_balance_sum, v_currency_count
    from public.ledger_entries
    where transaction_id = v_transaction_id;

  if v_entry_count < 2 then
    raise exception 'ledger transaction % must have at least two entries (has %)',
      v_transaction_id, v_entry_count
      using errcode = 'check_violation';
  end if;

  if v_balance_sum <> 0 then
    raise exception 'ledger transaction % entries do not sum to zero (sum = %)',
      v_transaction_id, v_balance_sum
      using errcode = 'check_violation';
  end if;

  if v_currency_count > 1 then
    raise exception 'ledger transaction % entries use more than one currency',
      v_transaction_id
      using errcode = 'check_violation';
  end if;

  return null; -- return value is ignored for AFTER triggers
end;
$$;

revoke all on function public.check_ledger_transaction_balance() from public, anon, authenticated;

drop trigger if exists ledger_entries_balance_check on public.ledger_entries;
create constraint trigger ledger_entries_balance_check
  after insert or update or delete on public.ledger_entries
  deferrable initially deferred
  for each row
  execute function public.check_ledger_transaction_balance();

-- 5c. Posted entries are immutable: no code path (including a future
-- accidental change to one of this migration's own functions) can update
-- or delete a row in public.ledger_entries once it exists.
create or replace function public.prevent_ledger_entry_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'ledger entries are immutable and cannot be %', lower(TG_OP)
    using errcode = 'insufficient_privilege';
end;
$$;

revoke all on function public.prevent_ledger_entry_mutation() from public, anon, authenticated;

drop trigger if exists ledger_entries_prevent_update on public.ledger_entries;
create trigger ledger_entries_prevent_update
  before update on public.ledger_entries
  for each row
  execute function public.prevent_ledger_entry_mutation();

drop trigger if exists ledger_entries_prevent_delete on public.ledger_entries;
create trigger ledger_entries_prevent_delete
  before delete on public.ledger_entries
  for each row
  execute function public.prevent_ledger_entry_mutation();

-- 5d. Account/institution ownership consistency (rule #3: "Institution
-- ownership must match account ownership").
create or replace function public.validate_account()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inst_user_id uuid;
begin
  if new.institution_id is not null then
    select user_id into v_inst_user_id
      from public.institutions
      where id = new.institution_id;

    if v_inst_user_id is null then
      raise exception 'account references a non-existent institution'
        using errcode = 'foreign_key_violation';
    end if;

    if v_inst_user_id <> new.user_id then
      raise exception 'account institution owner does not match account owner'
        using errcode = 'insufficient_privilege';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.validate_account() from public, anon, authenticated;

drop trigger if exists accounts_validate_institution_ownership on public.accounts;
create trigger accounts_validate_institution_ownership
  before insert or update on public.accounts
  for each row
  execute function public.validate_account();

-- 5e. Reversal ownership consistency (rule #9: "Reversal ownership must
-- match" / "Reversal links must remain within the same user").
create or replace function public.validate_ledger_transaction_reversal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_original_user_id uuid;
begin
  if new.reversal_of is not null then
    select user_id into v_original_user_id
      from public.ledger_transactions
      where id = new.reversal_of;

    if v_original_user_id is null then
      raise exception 'reversal references a non-existent original transaction'
        using errcode = 'foreign_key_violation';
    end if;

    if v_original_user_id <> new.user_id then
      raise exception 'reversal transaction owner does not match original transaction owner'
        using errcode = 'insufficient_privilege';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.validate_ledger_transaction_reversal()
  from public, anon, authenticated;

drop trigger if exists ledger_transactions_validate_reversal on public.ledger_transactions;
create trigger ledger_transactions_validate_reversal
  before insert or update on public.ledger_transactions
  for each row
  execute function public.validate_ledger_transaction_reversal();

-- =======================================================================
-- 6. updated_at triggers — reusing public.set_updated_at() from Phase 2
-- =======================================================================
-- public.set_updated_at() already exists (supabase/migrations/2026081709
-- 3736_create_profiles.sql), is security definer with a locked search_path,
-- and does exactly one thing: set NEW.updated_at = now(). Reused as-is —
-- no duplicate trigger function is created for this phase.

drop trigger if exists set_institutions_updated_at on public.institutions;
create trigger set_institutions_updated_at
  before update on public.institutions
  for each row
  execute function public.set_updated_at();

drop trigger if exists set_accounts_updated_at on public.accounts;
create trigger set_accounts_updated_at
  before update on public.accounts
  for each row
  execute function public.set_updated_at();

drop trigger if exists set_ledger_transactions_updated_at on public.ledger_transactions;
create trigger set_ledger_transactions_updated_at
  before update on public.ledger_transactions
  for each row
  execute function public.set_updated_at();

-- =======================================================================
-- 7. System-account provisioning
-- =======================================================================
-- Every user needs exactly three hidden system accounts: Opening Balance
-- Equity, Uncategorized Income, Uncategorized Expense. Provisioned by a
-- SEPARATE AFTER INSERT trigger on auth.users that coexists with (does
-- not replace) the existing on_auth_user_created -> handle_new_user()
-- trigger from supabase/migrations/20260817093736_create_profiles.sql.
-- Postgres runs multiple AFTER INSERT triggers on the same table in
-- alphabetical order by trigger name; both are independent and idempotent,
-- so ordering between them does not matter here.

create or replace function public.provision_system_accounts()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'provision_system_accounts requires an authenticated user'
      using errcode = 'insufficient_privilege';
  end if;

  insert into public.accounts (
    user_id, name, account_class, account_type, currency, is_system, system_code
  )
  values
    (v_user_id, 'Opening Balance Equity', 'equity', 'opening_balance_equity', 'INR', true, 'opening_balance_equity'),
    (v_user_id, 'Uncategorized Income', 'income', 'uncategorized_income', 'INR', true, 'uncategorized_income'),
    (v_user_id, 'Uncategorized Expense', 'expense', 'uncategorized_expense', 'INR', true, 'uncategorized_expense')
  on conflict (user_id, system_code) where is_system = true do nothing;
end;
$$;

revoke all on function public.provision_system_accounts() from public, anon;
grant execute on function public.provision_system_accounts() to authenticated;

comment on function public.provision_system_accounts() is
  'Creates the three hidden system accounts for the calling authenticated '
  'user if they do not already exist. Idempotent. Called automatically on '
  'signup (see handle_new_user_ledger_accounts below) and safe to call '
  'again manually to backfill existing users.';

-- Internal variant used by the auth.users trigger, which runs as the
-- Postgres superuser/owner performing the INSERT and has no session
-- corresponding to auth.uid(). Mirrors provision_system_accounts() but
-- takes the new user's id explicitly instead of reading it from the JWT.
create or replace function public.handle_new_user_ledger_accounts()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.accounts (
    user_id, name, account_class, account_type, currency, is_system, system_code
  )
  values
    (new.id, 'Opening Balance Equity', 'equity', 'opening_balance_equity', 'INR', true, 'opening_balance_equity'),
    (new.id, 'Uncategorized Income', 'income', 'uncategorized_income', 'INR', true, 'uncategorized_income'),
    (new.id, 'Uncategorized Expense', 'expense', 'uncategorized_expense', 'INR', true, 'uncategorized_expense')
  on conflict (user_id, system_code) where is_system = true do nothing;

  return new;
end;
$$;

revoke all on function public.handle_new_user_ledger_accounts() from public, anon, authenticated;

drop trigger if exists on_auth_user_created_ledger_accounts on auth.users;
create trigger on_auth_user_created_ledger_accounts
  after insert on auth.users
  for each row
  execute function public.handle_new_user_ledger_accounts();

-- Provisions hidden system ledger accounts for every new user. Runs
-- independently of on_auth_user_created (profile provisioning, Phase 2) —
-- each trigger owns one concern and neither replaces the other.
--
-- (Left as a plain SQL comment rather than `comment on trigger ... on
-- auth.users` — that statement requires ownership of auth.users, which the
-- migration role does not have on Supabase, even though it can create
-- triggers on it. Confirmed by a real `supabase db push` failure:
-- "ERROR: must be owner of relation users (SQLSTATE 42501)".)

-- Backfill: provision system accounts for any user created before this
-- migration (e.g. existing users from Phase 2). Safe to re-run.
insert into public.accounts (
  user_id, name, account_class, account_type, currency, is_system, system_code
)
select u.id, 'Opening Balance Equity', 'equity', 'opening_balance_equity', 'INR', true, 'opening_balance_equity'
from auth.users u
on conflict (user_id, system_code) where is_system = true do nothing;

insert into public.accounts (
  user_id, name, account_class, account_type, currency, is_system, system_code
)
select u.id, 'Uncategorized Income', 'income', 'uncategorized_income', 'INR', true, 'uncategorized_income'
from auth.users u
on conflict (user_id, system_code) where is_system = true do nothing;

insert into public.accounts (
  user_id, name, account_class, account_type, currency, is_system, system_code
)
select u.id, 'Uncategorized Expense', 'expense', 'uncategorized_expense', 'INR', true, 'uncategorized_expense'
from auth.users u
on conflict (user_id, system_code) where is_system = true do nothing;

-- =======================================================================
-- 8. Atomic transaction functions
-- =======================================================================

-- 8a. Create an account, optionally posting an opening-balance transaction
-- against the caller's Opening Balance Equity system account. Atomic: if
-- the opening-balance entries fail to balance or validate, the whole
-- account creation rolls back. account_class is always derived from
-- account_type here (server-side), never trusted from a client-supplied
-- class value.
create or replace function public.create_account_with_opening_balance(
  p_name text,
  p_account_type text,
  p_institution_id uuid default null,
  p_currency text default 'INR',
  p_last_four text default null,
  p_credit_limit text default null,
  p_opened_on date default null,
  p_notes text default null,
  p_opening_balance text default null,
  p_opening_balance_at timestamptz default null
)
returns public.accounts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_account_class text;
  v_account public.accounts;
  v_obe_account_id uuid;
  v_transaction_id uuid;
  -- Accepted as text (not numeric) so PostgREST/Postgres parses the exact
  -- decimal string produced by the TypeScript layer's money utilities with
  -- no JS floating-point round-trip; cast to numeric once here.
  v_credit_limit numeric := p_credit_limit::numeric;
  v_opening_balance numeric := p_opening_balance::numeric;
begin
  if v_user_id is null then
    raise exception 'create_account_with_opening_balance requires an authenticated user'
      using errcode = 'insufficient_privilege';
  end if;

  v_account_class := case p_account_type
    when 'bank_savings' then 'asset'
    when 'bank_current' then 'asset'
    when 'cash' then 'asset'
    when 'wallet' then 'asset'
    when 'other_asset' then 'asset'
    when 'credit_card' then 'liability'
    when 'loan' then 'liability'
    when 'other_liability' then 'liability'
    else null
  end;

  if v_account_class is null then
    raise exception 'unsupported account_type for a user-created account: %', p_account_type
      using errcode = 'invalid_parameter_value';
  end if;

  insert into public.accounts (
    user_id, institution_id, name, account_class, account_type, currency,
    last_four, credit_limit, opened_on, notes
  )
  values (
    v_user_id, p_institution_id, p_name, v_account_class, p_account_type, p_currency,
    p_last_four, v_credit_limit, p_opened_on, p_notes
  )
  returning * into v_account;

  if v_opening_balance is not null and v_opening_balance <> 0 then
    if p_opening_balance_at is null then
      raise exception 'p_opening_balance_at is required when p_opening_balance is provided'
        using errcode = 'invalid_parameter_value';
    end if;

    select id into v_obe_account_id
      from public.accounts
      where user_id = v_user_id and system_code = 'opening_balance_equity' and is_system = true;

    if v_obe_account_id is null then
      raise exception 'opening balance equity account is missing for this user'
        using errcode = 'data_exception';
    end if;

    insert into public.ledger_transactions (
      user_id, transaction_type, occurred_at, description, source_type
    )
    values (
      v_user_id, 'opening_balance', p_opening_balance_at,
      'Opening balance: ' || p_name, 'system'
    )
    returning id into v_transaction_id;

    -- Asset opening balance: debit the asset account, credit equity.
    -- Liability opening balance: credit the liability account (an
    -- existing debt is recorded as a negative/credit entry), debit
    -- equity. In both cases the two entries sum to zero.
    if v_account_class = 'asset' then
      insert into public.ledger_entries (user_id, transaction_id, account_id, amount, currency, memo)
      values
        (v_user_id, v_transaction_id, v_account.id, v_opening_balance, p_currency, 'Opening balance'),
        (v_user_id, v_transaction_id, v_obe_account_id, -v_opening_balance, p_currency, 'Opening balance');
    else
      insert into public.ledger_entries (user_id, transaction_id, account_id, amount, currency, memo)
      values
        (v_user_id, v_transaction_id, v_account.id, -v_opening_balance, p_currency, 'Opening balance'),
        (v_user_id, v_transaction_id, v_obe_account_id, v_opening_balance, p_currency, 'Opening balance');
    end if;
  end if;

  return v_account;
end;
$$;

revoke all on function public.create_account_with_opening_balance(
  text, text, uuid, text, text, text, date, text, text, timestamptz
) from public, anon;
grant execute on function public.create_account_with_opening_balance(
  text, text, uuid, text, text, text, date, text, text, timestamptz
) to authenticated;

comment on function public.create_account_with_opening_balance is
  'Atomically creates a user account and, when an opening balance is '
  'given, posts a balanced opening_balance transaction against the '
  'caller''s Opening Balance Equity system account. account_class is '
  'always derived server-side from account_type; never accepted from the '
  'caller.';

-- 8b. Generic manual transaction creator. p_entries is a JSON array of
-- {"account_id": uuid, "amount": numeric, "currency": text, "memo": text}
-- objects. This function stays deliberately agnostic to transaction-type-
-- specific account-class rules (e.g. "a transfer's two accounts must
-- differ") — those are enforced by the TypeScript Server Action layer
-- before calling this function. What this function and its triggers
-- enforce are the universal ledger invariants: ownership, currency
-- consistency, and sum-to-zero (via the deferred constraint trigger in
-- section 5b).
create or replace function public.create_manual_transaction(
  p_transaction_type text,
  p_occurred_at timestamptz,
  p_description text,
  p_entries jsonb,
  p_notes text default null
)
returns public.ledger_transactions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_transaction public.ledger_transactions;
  v_entry jsonb;
begin
  if v_user_id is null then
    raise exception 'create_manual_transaction requires an authenticated user'
      using errcode = 'insufficient_privilege';
  end if;

  if p_transaction_type not in ('income', 'expense', 'transfer', 'credit_card_purchase', 'credit_card_payment', 'adjustment') then
    raise exception 'unsupported manual transaction_type: %', p_transaction_type
      using errcode = 'invalid_parameter_value';
  end if;

  if jsonb_typeof(p_entries) <> 'array' or jsonb_array_length(p_entries) < 2 then
    raise exception 'p_entries must be a JSON array with at least two entries'
      using errcode = 'invalid_parameter_value';
  end if;

  insert into public.ledger_transactions (
    user_id, transaction_type, occurred_at, description, notes, source_type
  )
  values (
    v_user_id, p_transaction_type, p_occurred_at, p_description, p_notes, 'manual'
  )
  returning * into v_transaction;

  for v_entry in select * from jsonb_array_elements(p_entries)
  loop
    insert into public.ledger_entries (user_id, transaction_id, account_id, amount, currency, memo)
    values (
      v_user_id,
      v_transaction.id,
      (v_entry ->> 'account_id')::uuid,
      (v_entry ->> 'amount')::numeric(20, 4),
      coalesce(v_entry ->> 'currency', 'INR'),
      nullif(v_entry ->> 'memo', '')
    );
  end loop;

  return v_transaction;
end;
$$;

revoke all on function public.create_manual_transaction(text, timestamptz, text, jsonb, text)
  from public, anon;
grant execute on function public.create_manual_transaction(text, timestamptz, text, jsonb, text)
  to authenticated;

comment on function public.create_manual_transaction is
  'Atomically creates a manual ledger transaction and its entries from a '
  'generic JSONB entries payload. Universal invariants (ownership, '
  'currency, sum-to-zero) are enforced by row/constraint triggers; '
  'transaction-type-specific account-class rules are enforced by the '
  'calling application layer.';

-- 8c. Reverse a posted transaction. Race-safe: the guard UPDATE only
-- succeeds for a transaction that is currently 'posted' and not yet
-- reversed, so concurrent reversal attempts serialize on the row lock and
-- only one can ever succeed.
create or replace function public.reverse_transaction(
  p_transaction_id uuid,
  p_reversed_at timestamptz default now(),
  p_reason text default null
)
returns public.ledger_transactions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_original public.ledger_transactions;
  v_locked_id uuid;
  v_reversal public.ledger_transactions;
  v_entry record;
begin
  if v_user_id is null then
    raise exception 'reverse_transaction requires an authenticated user'
      using errcode = 'insufficient_privilege';
  end if;

  select * into v_original
    from public.ledger_transactions
    where id = p_transaction_id and user_id = v_user_id;

  if v_original.id is null then
    raise exception 'transaction not found'
      using errcode = 'no_data_found';
  end if;

  update public.ledger_transactions
    set status = 'reversed'
    where id = p_transaction_id
      and status = 'posted'
      and reversed_by is null
    returning id into v_locked_id;

  if v_locked_id is null then
    raise exception 'transaction % is not eligible for reversal (already reversed, or not posted)',
      p_transaction_id
      using errcode = 'invalid_transaction_state';
  end if;

  insert into public.ledger_transactions (
    user_id, transaction_type, occurred_at, description, notes, source_type, reversal_of
  )
  values (
    v_user_id, 'reversal', p_reversed_at,
    'Reversal of: ' || v_original.description, p_reason, 'system', p_transaction_id
  )
  returning * into v_reversal;

  for v_entry in
    select account_id, -amount as amount, currency, memo
    from public.ledger_entries
    where transaction_id = p_transaction_id
  loop
    insert into public.ledger_entries (user_id, transaction_id, account_id, amount, currency, memo)
    values (v_user_id, v_reversal.id, v_entry.account_id, v_entry.amount, v_entry.currency, v_entry.memo);
  end loop;

  update public.ledger_transactions
    set reversed_by = v_reversal.id
    where id = p_transaction_id;

  return v_reversal;
end;
$$;

revoke all on function public.reverse_transaction(uuid, timestamptz, text) from public, anon;
grant execute on function public.reverse_transaction(uuid, timestamptz, text) to authenticated;

comment on function public.reverse_transaction is
  'Atomically reverses a posted transaction: marks the original as '
  'reversed and posts a new linked reversal transaction with negated '
  'entries. Race-safe via a conditional UPDATE guard (status = ''posted'' '
  'and reversed_by is null); the original is never deleted, preserving '
  'full audit history.';

-- =======================================================================
-- 9. Balance view
-- =======================================================================
-- security_invoker means this view enforces RLS as the querying user, not
-- the view owner — it adds no privilege beyond what the underlying tables'
-- RLS policies already grant. No explicit user_id = auth.uid() filter is
-- needed for the same reason. Reversal entries need no special-casing:
-- negated entries net out naturally via plain SUM().

create or replace view public.account_balances
with (security_invoker = true) as
select
  a.id as account_id,
  a.user_id,
  a.name,
  a.account_class,
  a.account_type,
  a.currency,
  coalesce(sum(e.amount), 0)::numeric(20, 4) as signed_balance,
  case
    when a.account_class = 'liability' then -coalesce(sum(e.amount), 0)
    else coalesce(sum(e.amount), 0)
  end::numeric(20, 4) as display_balance
from public.accounts a
left join public.ledger_entries e on e.account_id = a.id
where a.is_system = false
group by a.id, a.user_id, a.name, a.account_class, a.account_type, a.currency;

revoke all on public.account_balances from public, anon;
grant select on public.account_balances to authenticated;

comment on view public.account_balances is
  'Per-account balances derived from posted ledger entries. security_invoker '
  'so results are always filtered by the underlying accounts/ledger_entries '
  'RLS policies for the querying user. display_balance flips sign for '
  'liability accounts so a debt shows as a positive "amount owed".';

-- =======================================================================
-- 10. Row Level Security
-- =======================================================================

alter table public.institutions enable row level security;
alter table public.institutions force row level security;

alter table public.accounts enable row level security;
alter table public.accounts force row level security;

alter table public.ledger_transactions enable row level security;
alter table public.ledger_transactions force row level security;

alter table public.ledger_entries enable row level security;
alter table public.ledger_entries force row level security;

revoke all on public.institutions from public, anon;
revoke all on public.accounts from public, anon;
revoke all on public.ledger_transactions from public, anon;
revoke all on public.ledger_entries from public, anon;

-- 10a. institutions: full CRUD for the owner, no delete (rule: "no
-- delete — institutions are kept for audit/history even if archived").
drop policy if exists institutions_select_own on public.institutions;
create policy institutions_select_own on public.institutions
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists institutions_insert_own on public.institutions;
create policy institutions_insert_own on public.institutions
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists institutions_update_own on public.institutions;
create policy institutions_update_own on public.institutions
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant select, insert on public.institutions to authenticated;
grant update (name, institution_type, website, notes, is_archived) on public.institutions to authenticated;

-- 10b. accounts: the owner can see all of their accounts, including
-- system ones (needed so balances/UI can look them up), but can only
-- insert/update non-system accounts directly. System accounts are only
-- ever created by provision_system_accounts() / the auth trigger, which
-- run as SECURITY DEFINER and therefore bypass RLS entirely.
drop policy if exists accounts_select_own on public.accounts;
create policy accounts_select_own on public.accounts
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists accounts_insert_own_non_system on public.accounts;
create policy accounts_insert_own_non_system on public.accounts
  for insert to authenticated
  with check (user_id = auth.uid() and is_system = false);

drop policy if exists accounts_update_own_non_system on public.accounts;
create policy accounts_update_own_non_system on public.accounts
  for update to authenticated
  using (user_id = auth.uid() and is_system = false)
  with check (user_id = auth.uid() and is_system = false);

grant select, insert on public.accounts to authenticated;
-- Column-scoped update grant: ownership/classification/system columns are
-- never updatable by the authenticated role, even accidentally — this is
-- the "cannot alter class/type after creation" guarantee (rule #6),
-- enforced unconditionally rather than only after ledger activity exists.
grant update (
  name, institution_id, last_four, credit_limit, opened_on, closed_on, notes, is_archived
) on public.accounts to authenticated;

-- 10c. ledger_transactions / ledger_entries: read-only for authenticated
-- users. All mutation happens exclusively through the SECURITY DEFINER
-- functions in section 8, which run as the function-owner role and so are
-- unaffected by the absence of insert/update/delete grants here.
drop policy if exists ledger_transactions_select_own on public.ledger_transactions;
create policy ledger_transactions_select_own on public.ledger_transactions
  for select to authenticated
  using (user_id = auth.uid());

grant select on public.ledger_transactions to authenticated;

drop policy if exists ledger_entries_select_own on public.ledger_entries;
create policy ledger_entries_select_own on public.ledger_entries
  for select to authenticated
  using (user_id = auth.uid());

grant select on public.ledger_entries to authenticated;

-- =======================================================================
-- 11. Indexes
-- =======================================================================

create index if not exists institutions_user_id_idx on public.institutions (user_id);

create index if not exists accounts_user_id_idx on public.accounts (user_id);
create index if not exists accounts_institution_id_idx on public.accounts (institution_id)
  where institution_id is not null;

create index if not exists ledger_transactions_user_id_occurred_at_idx
  on public.ledger_transactions (user_id, occurred_at desc);
create index if not exists ledger_transactions_reversal_of_idx
  on public.ledger_transactions (reversal_of)
  where reversal_of is not null;

create index if not exists ledger_entries_transaction_id_idx on public.ledger_entries (transaction_id);
create index if not exists ledger_entries_account_id_idx on public.ledger_entries (account_id);
create index if not exists ledger_entries_user_id_idx on public.ledger_entries (user_id);
