-- =======================================================================
-- Phase 5: Categories, Payees, transaction categorisation/idempotency,
-- safe editing, and dashboard aggregation.
--
-- Extends the Phase 3 double-entry ledger foundation
-- (20260817153217_create_ledger_foundation.sql) rather than replacing any
-- part of it. All existing tables, triggers, RPCs, and RLS policies are
-- untouched except where explicitly noted (ledger_transactions gains new
-- nullable columns; create_manual_transaction gains new optional
-- parameters with defaults, so every existing caller keeps working
-- unchanged).
-- =======================================================================

-- =======================================================================
-- 1. public.categories
-- =======================================================================

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  parent_id uuid null references public.categories (id) on delete set null,
  category_type text not null,
  name text not null,
  normalized_name text not null,
  slug text null,
  icon text null,
  color text null,
  sort_order integer not null default 0,
  is_system boolean not null default false,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint categories_type_valid check (category_type in ('income', 'expense')),
  constraint categories_name_length check (char_length(btrim(name)) between 1 and 60),
  constraint categories_icon_length check (icon is null or char_length(icon) <= 60),
  constraint categories_color_format check (color is null or color ~ '^#[0-9a-fA-F]{6}$'),
  constraint categories_no_self_parent check (parent_id is null or parent_id <> id)
);

comment on table public.categories is
  'User-owned income/expense categories, including a default set '
  'auto-provisioned per user (is_system = true, see '
  'provision_default_categories below). name is the editable display '
  'label; slug is a stable internal identifier only ever set on '
  'system-provisioned categories, used for idempotent reseeding — never '
  'exposed as something the user edits.';

-- A category's parent must belong to the same user and share the same
-- category_type — not expressible as a plain CHECK constraint (needs a
-- lookup on the same table), so enforced by trigger, mirroring
-- validate_ledger_entry's ownership-lookup style below.
create or replace function public.validate_category_parent()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_parent_user_id uuid;
  v_parent_type text;
begin
  if new.parent_id is null then
    return new;
  end if;

  select user_id, category_type into v_parent_user_id, v_parent_type
    from public.categories
    where id = new.parent_id;

  if v_parent_user_id is null then
    raise exception 'category references a non-existent parent category'
      using errcode = 'foreign_key_violation';
  end if;

  if v_parent_user_id <> new.user_id then
    raise exception 'category parent must belong to the same user'
      using errcode = 'insufficient_privilege';
  end if;

  if v_parent_type <> new.category_type then
    raise exception 'category parent must have the same category_type'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

revoke all on function public.validate_category_parent() from public, anon, authenticated;

drop trigger if exists categories_validate_parent on public.categories;
create trigger categories_validate_parent
  before insert or update on public.categories
  for each row
  execute function public.validate_category_parent();

drop trigger if exists set_categories_updated_at on public.categories;
create trigger set_categories_updated_at
  before update on public.categories
  for each row
  execute function public.set_updated_at();

-- Prevent duplicate ACTIVE categories of the same type+name per user
-- (case/whitespace-insensitive via normalized_name); archiving a category
-- frees its name for reuse.
create unique index if not exists categories_user_type_name_active_uidx
  on public.categories (user_id, category_type, normalized_name)
  where is_archived = false;

-- Idempotent-reseeding key: only ever set on system-provisioned
-- categories, at most one per (user, slug).
create unique index if not exists categories_user_slug_uidx
  on public.categories (user_id, slug)
  where slug is not null;

create index if not exists categories_user_id_idx on public.categories (user_id);
create index if not exists categories_parent_id_idx
  on public.categories (parent_id) where parent_id is not null;

-- =======================================================================
-- 2. public.payees
-- =======================================================================

create table if not exists public.payees (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  normalized_name text not null,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint payees_name_length check (char_length(btrim(name)) between 1 and 100)
);

comment on table public.payees is
  'User-owned payee/merchant records, optionally attached to a manual '
  'transaction. normalized_name (lower/trimmed) prevents accidental '
  'case/whitespace duplicates among a user''s active payees.';

drop trigger if exists set_payees_updated_at on public.payees;
create trigger set_payees_updated_at
  before update on public.payees
  for each row
  execute function public.set_updated_at();

create unique index if not exists payees_user_name_active_uidx
  on public.payees (user_id, normalized_name)
  where is_archived = false;

create index if not exists payees_user_id_idx on public.payees (user_id);

-- =======================================================================
-- 3. ledger_transactions: category/payee association + edit linkage
-- =======================================================================

alter table public.ledger_transactions
  add column if not exists category_id uuid null references public.categories (id),
  add column if not exists payee_id uuid null references public.payees (id),
  add column if not exists replaces_transaction_id uuid null
    references public.ledger_transactions (id);

comment on column public.ledger_transactions.category_id is
  'Optional category, only ever set for income/expense/credit_card_purchase '
  'transactions (see validate_ledger_transaction_refs) — never for '
  'transfer/credit_card_payment, which move money between the user''s own '
  'accounts and have no spending/income category.';
comment on column public.ledger_transactions.payee_id is
  'Optional payee/merchant, available for any manual transaction type.';
comment on column public.ledger_transactions.source_reference is
  'Reserved for future import idempotency (Phase 3 comment) — now also '
  'doubles as the client-supplied idempotency key for manual transaction '
  'creation (see create_manual_transaction), since both need exactly the '
  'same "one row per (user, key)" guarantee and the existing '
  'ledger_transactions_source_reference_unique index already provides it.';
comment on column public.ledger_transactions.replaces_transaction_id is
  'Set on the corrected replacement transaction produced by '
  'edit_manual_transaction, pointing back at the original it corrects. '
  'Deliberately a separate relationship from reversal_of/reversed_by '
  '(which record a true void/reversal) — an edit reverses the original '
  '*and* posts a fresh corrected transaction, and a single original '
  'cannot be the reversal_of target of two different transactions (see '
  'ledger_transactions_reversal_of_unique), so the edit relationship '
  'needs its own column.';

alter table public.ledger_transactions
  add constraint ledger_transactions_no_self_replace
    check (replaces_transaction_id is null or replaces_transaction_id <> id);

-- A given transaction can be corrected by at most one replacement,
-- mirroring ledger_transactions_reversal_of_unique's reasoning exactly.
create unique index if not exists ledger_transactions_replaces_unique
  on public.ledger_transactions (replaces_transaction_id)
  where replaces_transaction_id is not null;

-- category_id/payee_id ownership and type-compatibility: defense in
-- depth. create_manual_transaction/edit_manual_transaction are the only
-- intended write path (ledger_transactions has no direct insert/update
-- grant for `authenticated`, see section 6), but a future SECURITY
-- DEFINER function must not be able to accidentally bypass this by
-- forgetting the check itself.
create or replace function public.validate_ledger_transaction_refs()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
  v_category_type text;
begin
  if new.category_id is not null then
    select user_id, category_type into v_owner, v_category_type
      from public.categories
      where id = new.category_id;

    if v_owner is null then
      raise exception 'transaction references a non-existent category'
        using errcode = 'foreign_key_violation';
    end if;

    if v_owner <> new.user_id then
      raise exception 'transaction category must belong to the same user'
        using errcode = 'insufficient_privilege';
    end if;

    if new.transaction_type = 'income' then
      if v_category_type <> 'income' then
        raise exception 'income transactions require an income category'
          using errcode = 'check_violation';
      end if;
    elsif new.transaction_type in ('expense', 'credit_card_purchase') then
      if v_category_type <> 'expense' then
        raise exception '% transactions require an expense category', new.transaction_type
          using errcode = 'check_violation';
      end if;
    else
      raise exception '% transactions must not have a category', new.transaction_type
        using errcode = 'check_violation';
    end if;
  end if;

  if new.payee_id is not null then
    select user_id into v_owner from public.payees where id = new.payee_id;

    if v_owner is null then
      raise exception 'transaction references a non-existent payee'
        using errcode = 'foreign_key_violation';
    end if;

    if v_owner <> new.user_id then
      raise exception 'transaction payee must belong to the same user'
        using errcode = 'insufficient_privilege';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.validate_ledger_transaction_refs() from public, anon, authenticated;

drop trigger if exists ledger_transactions_validate_refs on public.ledger_transactions;
create trigger ledger_transactions_validate_refs
  before insert or update on public.ledger_transactions
  for each row
  execute function public.validate_ledger_transaction_refs();

create index if not exists ledger_transactions_category_id_idx
  on public.ledger_transactions (category_id) where category_id is not null;
create index if not exists ledger_transactions_payee_id_idx
  on public.ledger_transactions (payee_id) where payee_id is not null;
create index if not exists ledger_transactions_user_status_occurred_idx
  on public.ledger_transactions (user_id, status, occurred_at desc);

-- =======================================================================
-- 4. Default category provisioning — mirrors provision_system_accounts /
--    handle_new_user_ledger_accounts exactly (self-service entry point +
--    trigger-internal entry point sharing one internal, non-grantable
--    function so neither path can seed categories for another user).
-- =======================================================================

create or replace function public.provision_default_categories(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.categories (
    user_id, category_type, name, normalized_name, slug, icon, color, sort_order, is_system
  )
  values
    (p_user_id, 'expense', 'Food & Dining',    'food & dining',    'food_dining',     'utensils',        '#EF6C4D', 10,  true),
    (p_user_id, 'expense', 'Groceries',        'groceries',        'groceries',       'shopping-cart',   '#4C9A6A', 20,  true),
    (p_user_id, 'expense', 'Transport',        'transport',        'transport',       'car',             '#3B82F6', 30,  true),
    (p_user_id, 'expense', 'Housing',          'housing',          'housing',         'home',            '#8B5CF6', 40,  true),
    (p_user_id, 'expense', 'Utilities',        'utilities',        'utilities',       'plug',            '#0EA5E9', 50,  true),
    (p_user_id, 'expense', 'Shopping',         'shopping',         'shopping',        'shopping-bag',    '#EC4899', 60,  true),
    (p_user_id, 'expense', 'Healthcare',       'healthcare',       'healthcare',      'heart-pulse',     '#DC2626', 70,  true),
    (p_user_id, 'expense', 'Education',        'education',        'education',       'graduation-cap',  '#2563EB', 80,  true),
    (p_user_id, 'expense', 'Entertainment',    'entertainment',    'entertainment',   'clapperboard',    '#F59E0B', 90,  true),
    (p_user_id, 'expense', 'Travel',           'travel',           'travel',          'plane',           '#06B6D4', 100, true),
    (p_user_id, 'expense', 'Insurance',        'insurance',        'insurance',       'shield',          '#64748B', 110, true),
    (p_user_id, 'expense', 'Taxes',            'taxes',            'taxes',           'landmark',        '#78716C', 120, true),
    (p_user_id, 'expense', 'Fees & Charges',   'fees & charges',   'fees_charges',    'receipt',         '#94A3B8', 130, true),
    (p_user_id, 'expense', 'Gifts & Donations','gifts & donations','gifts_donations', 'gift',            '#F472B6', 140, true),
    (p_user_id, 'expense', 'Personal Care',    'personal care',    'personal_care',   'sparkles',        '#A855F7', 150, true),
    (p_user_id, 'expense', 'Other Expense',    'other expense',    'other_expense',   'more-horizontal', '#6B7280', 999, true),
    (p_user_id, 'income',  'Salary',           'salary',           'salary',          'wallet',          '#16A34A', 10,  true),
    (p_user_id, 'income',  'Business',         'business',         'business',        'briefcase',       '#0D9488', 20,  true),
    (p_user_id, 'income',  'Freelance',        'freelance',        'freelance',       'laptop',          '#0891B2', 30,  true),
    (p_user_id, 'income',  'Interest',         'interest',         'interest',        'percent',         '#65A30D', 40,  true),
    (p_user_id, 'income',  'Dividend',         'dividend',         'dividend',        'trending-up',     '#059669', 50,  true),
    (p_user_id, 'income',  'Rental Income',    'rental income',    'rental_income',   'building',        '#0284C7', 60,  true),
    (p_user_id, 'income',  'Refund',           'refund',           'refund',          'rotate-ccw',      '#7C3AED', 70,  true),
    (p_user_id, 'income',  'Gift Received',    'gift received',    'gift_received',   'gift',            '#DB2777', 80,  true),
    (p_user_id, 'income',  'Other Income',     'other income',     'other_income',    'more-horizontal', '#6B7280', 999, true)
  on conflict (user_id, slug) where slug is not null do nothing;
end;
$$;

revoke all on function public.provision_default_categories(uuid) from public, anon, authenticated;

comment on function public.provision_default_categories(uuid) is
  'Internal: inserts the default category set for the given user id. '
  'Idempotent (matched by slug). Trusts p_user_id without checking '
  'auth.uid(), so it is never granted directly to authenticated — see '
  'provision_default_categories_self() for the self-service entry point '
  'and handle_new_user_categories() for the signup-trigger entry point.';

create or replace function public.provision_default_categories_self()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'provision_default_categories_self requires an authenticated user'
      using errcode = 'insufficient_privilege';
  end if;

  perform public.provision_default_categories(v_user_id);
end;
$$;

revoke all on function public.provision_default_categories_self() from public, anon;
grant execute on function public.provision_default_categories_self() to authenticated;

comment on function public.provision_default_categories_self() is
  'Creates the default category set for the calling authenticated user if '
  'missing. Idempotent — safe to call on every categories-page load, a '
  'backfill safety net for any user who existed before this migration.';

create or replace function public.handle_new_user_categories()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.provision_default_categories(new.id);
  return new;
end;
$$;

revoke all on function public.handle_new_user_categories() from public, anon, authenticated;

drop trigger if exists on_auth_user_created_categories on auth.users;
create trigger on_auth_user_created_categories
  after insert on auth.users
  for each row
  execute function public.handle_new_user_categories();

-- Backfill for any user created before this migration. Idempotent (the
-- function itself is), so safe to re-run this whole migration file.
do $$
declare
  v_user record;
begin
  for v_user in select id from auth.users loop
    perform public.provision_default_categories(v_user.id);
  end loop;
end;
$$;

-- =======================================================================
-- 5. Atomic transaction functions: extend create_manual_transaction,
--    add edit_manual_transaction.
-- =======================================================================

-- Adds p_category_id / p_payee_id / p_idempotency_key as new optional
-- (defaulted) parameters. Postgres resolves `create or replace function`
-- by full signature (name + parameter types), so a function with extra
-- parameters is a distinct overload, not a replacement of the original —
-- the old 5-parameter signature must be dropped explicitly, or both
-- versions would remain independently callable (the old one missing the
-- category/payee/idempotency support and this migration's grants).
drop function if exists public.create_manual_transaction(text, timestamptz, text, jsonb, text);

create or replace function public.create_manual_transaction(
  p_transaction_type text,
  p_occurred_at timestamptz,
  p_description text,
  p_entries jsonb,
  p_notes text default null,
  p_category_id uuid default null,
  p_payee_id uuid default null,
  p_idempotency_key text default null
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

  -- Idempotent replay, race-safe: the insert either creates the row or
  -- conflicts against an existing (user_id, source_reference) pair and
  -- does nothing, and v_transaction.id being null afterwards tells us
  -- which happened — a plain "select then insert" would leave a window
  -- for two concurrent double-submissions with the same key to both pass
  -- the select and then race on the insert.
  insert into public.ledger_transactions (
    user_id, transaction_type, occurred_at, description, notes, source_type,
    source_reference, category_id, payee_id
  )
  values (
    v_user_id, p_transaction_type, p_occurred_at, p_description, p_notes, 'manual',
    p_idempotency_key, p_category_id, p_payee_id
  )
  on conflict (user_id, source_reference) where source_reference is not null
  do nothing
  returning * into v_transaction;

  if v_transaction.id is null then
    if p_idempotency_key is null then
      raise exception 'create_manual_transaction: insert unexpectedly produced no row'
        using errcode = 'data_exception';
    end if;

    select * into v_transaction
      from public.ledger_transactions
      where user_id = v_user_id and source_reference = p_idempotency_key;

    return v_transaction;
  end if;

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

revoke all on function public.create_manual_transaction(text, timestamptz, text, jsonb, text, uuid, uuid, text)
  from public, anon;
grant execute on function public.create_manual_transaction(text, timestamptz, text, jsonb, text, uuid, uuid, text)
  to authenticated;

comment on function public.create_manual_transaction(text, timestamptz, text, jsonb, text, uuid, uuid, text) is
  'Atomically creates a manual ledger transaction and its entries from a '
  'generic JSONB entries payload. Universal invariants (ownership, '
  'currency, sum-to-zero) are enforced by row/constraint triggers; '
  'transaction-type-specific account-class rules are enforced by the '
  'calling application layer. p_idempotency_key reuses '
  'source_reference''s existing per-user unique index: a duplicate '
  'double-submission with the same key returns the transaction that '
  'already exists instead of creating a second one.';

-- 5b. Edit a posted manual transaction. Ledger entries are immutable once
-- posted (see prevent_ledger_entry_mutation), so an "edit" is: reverse the
-- original exactly like reverse_transaction() does, then atomically post a
-- fresh corrected transaction in the same database transaction, linked
-- back via replaces_transaction_id. Both halves succeed or both roll back.
create or replace function public.edit_manual_transaction(
  p_transaction_id uuid,
  p_occurred_at timestamptz,
  p_description text,
  p_entries jsonb,
  p_notes text default null,
  p_category_id uuid default null,
  p_payee_id uuid default null,
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
  v_replacement public.ledger_transactions;
  v_entry jsonb;
  v_reversal_entry record;
begin
  if v_user_id is null then
    raise exception 'edit_manual_transaction requires an authenticated user'
      using errcode = 'insufficient_privilege';
  end if;

  select * into v_original
    from public.ledger_transactions
    where id = p_transaction_id and user_id = v_user_id;

  if v_original.id is null then
    raise exception 'transaction not found'
      using errcode = 'no_data_found';
  end if;

  if v_original.source_type <> 'manual' then
    raise exception 'only manually-created transactions can be edited'
      using errcode = 'invalid_transaction_state';
  end if;

  if jsonb_typeof(p_entries) <> 'array' or jsonb_array_length(p_entries) < 2 then
    raise exception 'p_entries must be a JSON array with at least two entries'
      using errcode = 'invalid_parameter_value';
  end if;

  -- Same race-safe guard as reverse_transaction: only a currently-posted,
  -- not-yet-reversed transaction is eligible for editing.
  update public.ledger_transactions
    set status = 'reversed'
    where id = p_transaction_id
      and status = 'posted'
      and reversed_by is null
    returning id into v_locked_id;

  if v_locked_id is null then
    raise exception 'transaction % is not eligible for editing (already reversed/edited, or not posted)',
      p_transaction_id
      using errcode = 'invalid_transaction_state';
  end if;

  -- Backdated to the original's own occurred_at (unlike
  -- reverse_transaction's plain void, which is dated "now" by default) so
  -- the original and its reversal always land in the same reporting
  -- period and cancel cleanly in dashboard_summary/dashboard_expense_by_
  -- category/dashboard_cash_flow_trend regardless of when the edit itself
  -- was made — see the section 6 header comment.
  insert into public.ledger_transactions (
    user_id, transaction_type, occurred_at, description, notes, source_type, reversal_of
  )
  values (
    v_user_id, 'reversal', v_original.occurred_at,
    'Correction of: ' || v_original.description,
    coalesce(p_reason, 'Edited'), 'system', p_transaction_id
  )
  returning * into v_reversal;

  for v_reversal_entry in
    select account_id, -amount as amount, currency, memo
    from public.ledger_entries
    where transaction_id = p_transaction_id
  loop
    insert into public.ledger_entries (user_id, transaction_id, account_id, amount, currency, memo)
    values (
      v_user_id, v_reversal.id, v_reversal_entry.account_id,
      v_reversal_entry.amount, v_reversal_entry.currency, v_reversal_entry.memo
    );
  end loop;

  update public.ledger_transactions
    set reversed_by = v_reversal.id
    where id = p_transaction_id;

  insert into public.ledger_transactions (
    user_id, transaction_type, occurred_at, description, notes, source_type,
    category_id, payee_id, replaces_transaction_id
  )
  values (
    v_user_id, v_original.transaction_type, p_occurred_at, p_description, p_notes, 'manual',
    p_category_id, p_payee_id, p_transaction_id
  )
  returning * into v_replacement;

  for v_entry in select * from jsonb_array_elements(p_entries)
  loop
    insert into public.ledger_entries (user_id, transaction_id, account_id, amount, currency, memo)
    values (
      v_user_id,
      v_replacement.id,
      (v_entry ->> 'account_id')::uuid,
      (v_entry ->> 'amount')::numeric(20, 4),
      coalesce(v_entry ->> 'currency', 'INR'),
      nullif(v_entry ->> 'memo', '')
    );
  end loop;

  return v_replacement;
end;
$$;

revoke all on function public.edit_manual_transaction(uuid, timestamptz, text, jsonb, text, uuid, uuid, text)
  from public, anon;
grant execute on function public.edit_manual_transaction(uuid, timestamptz, text, jsonb, text, uuid, uuid, text)
  to authenticated;

comment on function public.edit_manual_transaction(uuid, timestamptz, text, jsonb, text, uuid, uuid, text) is
  'Atomically corrects a posted manual transaction: reverses the original '
  '(status -> reversed, linked via reversal_of/reversed_by, exactly like '
  'reverse_transaction) and posts a fresh replacement with the corrected '
  'values in the same database transaction, linked via '
  'replaces_transaction_id. Race-safe via the same conditional UPDATE '
  'guard as reverse_transaction. The original is never deleted or '
  'mutated in place.';

-- =======================================================================
-- 6. Dashboard aggregation RPCs — SECURITY INVOKER, so results are
--    always scoped by the caller's own RLS-filtered rows (same reasoning
--    as public.account_balances above). Defined via account_class rather
--    than transaction_type so every rule in the Phase 5 spec falls out
--    naturally from the existing double-entry structure: transfers never
--    touch an income/expense-class account, so they're automatically
--    excluded; credit-card purchases post through the expense-class
--    Uncategorized Expense account, so they're automatically included;
--    credit-card payments only touch asset+liability accounts, so
--    they're automatically excluded.
--
--    Deliberately no `status = 'posted'` filter, for the same reason
--    account_balances has none: a reversed transaction's entries and its
--    reversal's negated entries always sum to exactly zero, so including
--    both is what makes the arithmetic self-correcting. Filtering to only
--    `posted` rows would keep the reversal's entries (status stays
--    'posted') while dropping the original's matching offset (status
--    becomes 'reversed'), turning every void/edit into a phantom
--    over-count. edit_manual_transaction backdates its reversal to the
--    original transaction's own occurred_at (not "now"), so an edit's
--    original+reversal pair always cancels within the same reporting
--    period regardless of when the edit itself was made.
-- =======================================================================

create or replace function public.dashboard_summary(p_start date, p_end date)
returns table (
  total_income numeric(20, 4),
  total_expense numeric(20, 4),
  net_cash_flow numeric(20, 4)
)
language sql
security invoker
set search_path = ''
stable
as $$
  select
    coalesce(income.total, 0)::numeric(20, 4) as total_income,
    coalesce(expense.total, 0)::numeric(20, 4) as total_expense,
    (coalesce(income.total, 0) - coalesce(expense.total, 0))::numeric(20, 4) as net_cash_flow
  from
    (
      select -sum(e.amount) as total
      from public.ledger_entries e
      join public.ledger_transactions t on t.id = e.transaction_id
      join public.accounts a on a.id = e.account_id
      where a.account_class = 'income'
        and t.occurred_at >= p_start::timestamptz
        and t.occurred_at < (p_end + 1)::timestamptz
    ) as income,
    (
      select sum(e.amount) as total
      from public.ledger_entries e
      join public.ledger_transactions t on t.id = e.transaction_id
      join public.accounts a on a.id = e.account_id
      where a.account_class = 'expense'
        and t.occurred_at >= p_start::timestamptz
        and t.occurred_at < (p_end + 1)::timestamptz
    ) as expense;
$$;

revoke all on function public.dashboard_summary(date, date) from public, anon;
grant execute on function public.dashboard_summary(date, date) to authenticated;

comment on function public.dashboard_summary(date, date) is
  'Total income, total expense, and net cash flow for [p_start, p_end] '
  '(inclusive), scoped to the caller via RLS (SECURITY INVOKER). Excludes '
  'transfers and credit-card payments by construction — see the section '
  '6 header comment.';

create or replace function public.dashboard_expense_by_category(p_start date, p_end date)
returns table (
  category_id uuid,
  category_name text,
  category_icon text,
  category_color text,
  total_amount numeric(20, 4)
)
language sql
security invoker
set search_path = ''
stable
as $$
  select
    c.id as category_id,
    coalesce(c.name, 'Uncategorized') as category_name,
    c.icon as category_icon,
    c.color as category_color,
    sum(e.amount)::numeric(20, 4) as total_amount
  from public.ledger_entries e
  join public.ledger_transactions t on t.id = e.transaction_id
  join public.accounts a on a.id = e.account_id
  left join public.categories c on c.id = t.category_id
  where a.account_class = 'expense'
    and t.occurred_at >= p_start::timestamptz
    and t.occurred_at < (p_end + 1)::timestamptz
  group by c.id, c.name, c.icon, c.color
  order by total_amount desc;
$$;

revoke all on function public.dashboard_expense_by_category(date, date) from public, anon;
grant execute on function public.dashboard_expense_by_category(date, date) to authenticated;

comment on function public.dashboard_expense_by_category(date, date) is
  'Expense total per category for [p_start, p_end] (inclusive), scoped to '
  'the caller via RLS. A null category_id/category_name row means '
  '"Uncategorized" expenses in that period.';

create or replace function public.dashboard_cash_flow_trend(p_start date, p_end date)
returns table (
  period_month date,
  total_income numeric(20, 4),
  total_expense numeric(20, 4)
)
language sql
security invoker
set search_path = ''
stable
as $$
  select
    date_trunc('month', t.occurred_at)::date as period_month,
    coalesce(sum(-e.amount) filter (where a.account_class = 'income'), 0)::numeric(20, 4) as total_income,
    coalesce(sum(e.amount) filter (where a.account_class = 'expense'), 0)::numeric(20, 4) as total_expense
  from public.ledger_entries e
  join public.ledger_transactions t on t.id = e.transaction_id
  join public.accounts a on a.id = e.account_id
  where a.account_class in ('income', 'expense')
    and t.occurred_at >= p_start::timestamptz
    and t.occurred_at < (p_end + 1)::timestamptz
  group by date_trunc('month', t.occurred_at)
  order by period_month;
$$;

revoke all on function public.dashboard_cash_flow_trend(date, date) from public, anon;
grant execute on function public.dashboard_cash_flow_trend(date, date) to authenticated;

comment on function public.dashboard_cash_flow_trend(date, date) is
  'One row per calendar month in [p_start, p_end] that had any '
  'income/expense activity, scoped to the caller via RLS. Months with no '
  'activity simply do not appear — the caller fills gaps for display.';

-- =======================================================================
-- 7. Row Level Security
-- =======================================================================

alter table public.categories enable row level security;
alter table public.categories force row level security;

alter table public.payees enable row level security;
alter table public.payees force row level security;

revoke all on public.categories from public, anon;
revoke all on public.payees from public, anon;

-- 7a. categories: full CRUD for the owner's own custom (non-system)
-- categories; system/default categories are read-only for everyone,
-- including their own owner — mirrors accounts_update_own_non_system
-- exactly (a system row's is_system=false precondition can never be met,
-- so no UPDATE/INSERT statement can ever touch one).
drop policy if exists categories_select_own on public.categories;
create policy categories_select_own on public.categories
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists categories_insert_own_non_system on public.categories;
create policy categories_insert_own_non_system on public.categories
  for insert to authenticated
  with check (user_id = auth.uid() and is_system = false);

drop policy if exists categories_update_own_non_system on public.categories;
create policy categories_update_own_non_system on public.categories
  for update to authenticated
  using (user_id = auth.uid() and is_system = false)
  with check (user_id = auth.uid() and is_system = false);

grant select, insert on public.categories to authenticated;
grant update (name, normalized_name, icon, color, sort_order, is_archived, parent_id)
  on public.categories to authenticated;

-- 7b. payees: full CRUD for the owner, no delete (kept for the same
-- audit-history reason as institutions — a past transaction may still
-- reference an archived payee).
drop policy if exists payees_select_own on public.payees;
create policy payees_select_own on public.payees
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists payees_insert_own on public.payees;
create policy payees_insert_own on public.payees
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists payees_update_own on public.payees;
create policy payees_update_own on public.payees
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant select, insert on public.payees to authenticated;
grant update (name, normalized_name, is_archived) on public.payees to authenticated;
