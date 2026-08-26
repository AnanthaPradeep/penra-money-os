-- =======================================================================
-- Phase 12a — Purpose wallets and income allocation plans.
--
-- Architecture summary:
--   * A purpose wallet is a virtual earmarking layer over money the user
--     already has in a real account — never a duplicate asset, never
--     included in net worth. Its balance is never a mutable stored
--     column; it is always derived by summing an immutable, append-only
--     movement ledger (public.purpose_wallet_movements), mirroring how
--     public.account_balances derives a real account's balance by
--     summing public.ledger_entries rather than caching a total anywhere
--     — the same "derive, never cache-and-drift" principle applied one
--     layer up.
--   * Reallocating between two wallets (public.reallocate_purpose_wallet)
--     writes exactly two movement rows (one wallet decreases, the other
--     increases) sharing a movement_group_id, and never touches
--     ledger_transactions/ledger_entries at all — per the spec's explicit
--     "Create no ledger transaction... Leave account balances and net
--     worth unchanged" requirement. A real transfer between two actual
--     bank accounts is a completely separate action using the existing
--     trusted transfer workflow (buildTransferEntries /
--     create_manual_transaction), never this one.
--   * Tagging an expense transaction to a wallet
--     (public.assign_transaction_to_purpose_wallet) writes one row to
--     public.transaction_purpose_allocations (at most one wallet per
--     transaction) plus one 'expense_spend' movement row consuming that
--     wallet's balance. When that transaction is later reversed or
--     edited-and-replaced through the *existing*, untouched reversal/edit
--     workflow (create_manual_transaction / reverse_transaction /
--     edit_manual_transaction — none of which are modified by this
--     migration), an AFTER INSERT trigger on ledger_transactions detects
--     the new row's reversal_of/replaces_transaction_id and restores (and,
--     for an edit-replacement, re-applies at the corrected amount) the
--     wallet effect automatically — no ledger posting logic is
--     duplicated; this migration only ever *reads* ledger_transactions
--     rows the existing trusted core already created.
--   * Income allocation plans are applied to one income transaction at a
--     time via an explicit RPC
--     (public.apply_income_allocation_plan_to_transaction), never
--     automatically/silently on every income posting — the user (or a
--     future income-recording flow) always triggers this deliberately,
--     and it is idempotent per (plan, transaction) via a unique
--     application-record index, exactly like every other posting path in
--     this app being idempotent via a deterministic key.
-- =======================================================================

-- =======================================================================
-- 1. Widen ledger_transactions_type_valid to add debt-related types
--    ('debt_proceeds', 'debt_payment') — used by the Phase 12b debt
--    migration, added here since this file already touches the
--    constraint and both migrations are part of one phase. Purely
--    additive (superset), the exact widening pattern Phase 7 used to add
--    'investment_buy' etc.
-- =======================================================================

alter table public.ledger_transactions drop constraint if exists ledger_transactions_type_valid;
alter table public.ledger_transactions add constraint ledger_transactions_type_valid check (
  transaction_type in (
    'opening_balance', 'income', 'expense', 'transfer', 'credit_card_purchase', 'credit_card_payment',
    'adjustment', 'reversal', 'investment_buy', 'investment_sell', 'investment_contribution',
    'investment_withdrawal', 'investment_maturity', 'debt_proceeds', 'debt_payment'
  )
);

-- post_manual_transaction_for_user (Phase 6/7/11) carries its own
-- separate hardcoded transaction_type whitelist, independent of the
-- table CHECK constraint above — widening only the CHECK (as above)
-- without also widening this function's own list would leave
-- 'debt_proceeds'/'debt_payment' rejected by every caller that goes
-- through this shared posting core (record_debt_proceeds /
-- record_debt_payment below both do). This is a same-signature
-- `create or replace` (byte-for-byte identical to the Phase 11 version
-- otherwise), so it correctly replaces rather than creating a second
-- overload — see 20260825170709_phase11_fix_post_manual_transaction_
-- overload.sql for exactly what goes wrong when a signature isn't kept
-- identical.
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
    'investment_buy', 'investment_sell', 'investment_contribution', 'investment_withdrawal', 'investment_maturity',
    'debt_proceeds', 'debt_payment'
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
-- 2. public.purpose_wallets
-- =======================================================================

create table if not exists public.purpose_wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  icon text null,
  color text null,
  description text null,
  currency text not null default 'INR',
  priority integer not null default 0,
  target_amount numeric(20, 4) null,
  funding_mode text not null default 'earmarked',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint purpose_wallets_name_length check (char_length(btrim(name)) between 1 and 80),
  constraint purpose_wallets_description_length check (description is null or char_length(description) <= 500),
  constraint purpose_wallets_color_format check (color is null or color ~ '^#[0-9a-fA-F]{6}$'),
  constraint purpose_wallets_currency_format check (currency ~ '^[A-Z]{3}$'),
  constraint purpose_wallets_target_amount_positive check (target_amount is null or target_amount > 0),
  constraint purpose_wallets_funding_mode_valid check (funding_mode in ('earmarked', 'planning_only')),
  constraint purpose_wallets_status_valid check (status in ('active', 'archived'))
);

comment on table public.purpose_wallets is
  'A virtual earmarking layer over money the user already holds in real accounts — never a duplicate asset and never included in net worth. Balance is always derived by summing purpose_wallet_movements, never stored as a mutable column here.';

create index if not exists purpose_wallets_user_status_idx
  on public.purpose_wallets (user_id, status, priority desc);

drop trigger if exists set_purpose_wallets_updated_at on public.purpose_wallets;
create trigger set_purpose_wallets_updated_at
  before update on public.purpose_wallets
  for each row
  execute function public.set_updated_at();

-- =======================================================================
-- 3. public.purpose_wallet_movements — the immutable, append-only ledger
--    every wallet balance is derived from. Never updated or deleted by
--    any RPC in this migration (only ever inserted).
-- =======================================================================

create table if not exists public.purpose_wallet_movements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  wallet_id uuid not null references public.purpose_wallets (id) on delete cascade,
  movement_kind text not null,
  amount numeric(20, 4) not null,
  currency text not null default 'INR',
  counterparty_wallet_id uuid null references public.purpose_wallets (id) on delete set null,
  related_transaction_id uuid null references public.ledger_transactions (id) on delete set null,
  related_income_application_id uuid null,
  movement_group_id uuid null,
  memo text null,
  created_at timestamptz not null default now(),

  constraint purpose_wallet_movements_kind_valid check (
    movement_kind in (
      'manual_allocation', 'reallocation_in', 'reallocation_out', 'income_plan_allocation',
      'goal_contribution', 'goal_withdrawal', 'expense_spend', 'expense_reversal', 'release'
    )
  ),
  constraint purpose_wallet_movements_amount_nonzero check (amount <> 0),
  constraint purpose_wallet_movements_currency_format check (currency ~ '^[A-Z]{3}$'),
  constraint purpose_wallet_movements_memo_length check (memo is null or char_length(memo) <= 300),
  -- The sign of amount must match the direction implied by movement_kind
  -- — enforced here (not just by the RPCs that insert these rows) so a
  -- future bug in an RPC can never silently write a movement whose sign
  -- contradicts its own kind.
  constraint purpose_wallet_movements_sign_matches_kind check (
    (movement_kind in ('manual_allocation', 'reallocation_in', 'income_plan_allocation', 'goal_contribution', 'expense_reversal') and amount > 0)
    or (movement_kind in ('reallocation_out', 'goal_withdrawal', 'expense_spend', 'release') and amount < 0)
  )
);

comment on table public.purpose_wallet_movements is
  'Immutable, append-only movement ledger — every purpose_wallets balance is derived by summing these rows for that wallet, never cached. Positive amount increases the wallet''s allocated balance, negative decreases it (see purpose_wallet_movements_sign_matches_kind).';

create index if not exists purpose_wallet_movements_wallet_idx
  on public.purpose_wallet_movements (wallet_id, created_at);
create index if not exists purpose_wallet_movements_user_idx
  on public.purpose_wallet_movements (user_id, created_at desc);
create index if not exists purpose_wallet_movements_transaction_idx
  on public.purpose_wallet_movements (related_transaction_id) where related_transaction_id is not null;
create index if not exists purpose_wallet_movements_group_idx
  on public.purpose_wallet_movements (movement_group_id) where movement_group_id is not null;

-- =======================================================================
-- 4. public.transaction_purpose_allocations — at most one purpose wallet
--    per ledger transaction. The row that
--    assign_transaction_to_purpose_wallet / the reversal-restoration
--    trigger both read and write.
-- =======================================================================

create table if not exists public.transaction_purpose_allocations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  transaction_id uuid not null references public.ledger_transactions (id) on delete cascade,
  wallet_id uuid not null references public.purpose_wallets (id) on delete restrict,
  amount numeric(20, 4) not null,
  created_at timestamptz not null default now(),

  constraint transaction_purpose_allocations_amount_positive check (amount > 0),
  constraint transaction_purpose_allocations_transaction_unique unique (transaction_id)
);

comment on table public.transaction_purpose_allocations is
  'Links at most one purpose wallet to a ledger transaction (the unique constraint on transaction_id is the structural guarantee). amount is a denormalized copy of the transaction''s expense amount, kept only for audit convenience — the actual wallet effect always lives in purpose_wallet_movements.';

create index if not exists transaction_purpose_allocations_wallet_idx
  on public.transaction_purpose_allocations (wallet_id);

-- =======================================================================
-- 5. public.income_allocation_plans / lines / applications.
-- =======================================================================

create table if not exists public.income_allocation_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  allocation_mode text not null,
  trigger_category_id uuid null references public.categories (id) on delete set null,
  trigger_payee_id uuid null references public.payees (id) on delete set null,
  trigger_account_id uuid null references public.accounts (id) on delete set null,
  currency text not null default 'INR',
  effective_date date not null,
  end_date date null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint income_allocation_plans_name_length check (char_length(btrim(name)) between 1 and 100),
  constraint income_allocation_plans_mode_valid check (allocation_mode in ('percentage', 'fixed_amount', 'hybrid', 'manual')),
  constraint income_allocation_plans_currency_format check (currency ~ '^[A-Z]{3}$'),
  constraint income_allocation_plans_status_valid check (status in ('active', 'paused', 'archived')),
  constraint income_allocation_plans_end_after_effective check (end_date is null or end_date >= effective_date)
);

comment on table public.income_allocation_plans is
  'A reusable template for splitting a received income transaction across purpose wallets. Never applied automatically — always via an explicit apply_income_allocation_plan_to_transaction call. Editing a plan (or its lines) only ever affects future applications; every already-recorded application and its resulting wallet movements are immutable history.';

create index if not exists income_allocation_plans_user_status_idx
  on public.income_allocation_plans (user_id, status);

drop trigger if exists set_income_allocation_plans_updated_at on public.income_allocation_plans;
create trigger set_income_allocation_plans_updated_at
  before update on public.income_allocation_plans
  for each row
  execute function public.set_updated_at();

create table if not exists public.income_allocation_plan_lines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  plan_id uuid not null references public.income_allocation_plans (id) on delete cascade,
  wallet_id uuid not null references public.purpose_wallets (id) on delete restrict,
  line_order integer not null default 0,
  percentage numeric(6, 3) null,
  fixed_amount numeric(20, 4) null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint income_allocation_plan_lines_percentage_range check (percentage is null or (percentage > 0 and percentage <= 100)),
  constraint income_allocation_plan_lines_fixed_amount_positive check (fixed_amount is null or fixed_amount > 0),
  constraint income_allocation_plan_lines_has_value check (percentage is not null or fixed_amount is not null),
  constraint income_allocation_plan_lines_plan_wallet_unique unique (plan_id, wallet_id)
);

comment on table public.income_allocation_plan_lines is
  'One ordered line of an income_allocation_plans row. A percentage-mode or fixed_amount-mode plan uses only the matching column on every line; a hybrid plan may mix both (fixed lines are applied first, remaining percentage lines split what''s left) — see apply_income_allocation_plan_to_transaction for the exact order.';

create index if not exists income_allocation_plan_lines_plan_idx
  on public.income_allocation_plan_lines (plan_id, line_order);

drop trigger if exists set_income_allocation_plan_lines_updated_at on public.income_allocation_plan_lines;
create trigger set_income_allocation_plan_lines_updated_at
  before update on public.income_allocation_plan_lines
  for each row
  execute function public.set_updated_at();

create table if not exists public.income_allocation_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  plan_id uuid not null references public.income_allocation_plans (id) on delete restrict,
  transaction_id uuid not null references public.ledger_transactions (id) on delete cascade,
  allocated_total numeric(20, 4) not null,
  unallocated_remainder numeric(20, 4) not null,
  status text not null default 'applied',
  created_at timestamptz not null default now(),
  reversed_at timestamptz null,

  constraint income_allocation_applications_allocated_nonnegative check (allocated_total >= 0),
  constraint income_allocation_applications_remainder_nonnegative check (unallocated_remainder >= 0),
  constraint income_allocation_applications_status_valid check (status in ('applied', 'reversed')),
  -- The idempotency boundary: a plan can only ever be applied once to any
  -- one income transaction.
  constraint income_allocation_applications_plan_transaction_unique unique (plan_id, transaction_id)
);

comment on table public.income_allocation_applications is
  'One row per (plan, income transaction) application — the unique constraint is what makes apply_income_allocation_plan_to_transaction idempotent. Reversing the income transaction (via the existing, untouched reversal workflow) flips status to reversed and reverses every purpose_wallet_movements row this application created, via the same AFTER INSERT trigger that restores a spent wallet allocation on reversal.';

create index if not exists income_allocation_applications_transaction_idx
  on public.income_allocation_applications (transaction_id);

-- =======================================================================
-- 6. RLS — enabled and forced on every new table.
-- =======================================================================

alter table public.purpose_wallets enable row level security;
alter table public.purpose_wallets force row level security;
alter table public.purpose_wallet_movements enable row level security;
alter table public.purpose_wallet_movements force row level security;
alter table public.transaction_purpose_allocations enable row level security;
alter table public.transaction_purpose_allocations force row level security;
alter table public.income_allocation_plans enable row level security;
alter table public.income_allocation_plans force row level security;
alter table public.income_allocation_plan_lines enable row level security;
alter table public.income_allocation_plan_lines force row level security;
alter table public.income_allocation_applications enable row level security;
alter table public.income_allocation_applications force row level security;

-- purpose_wallets: SELECT-only — every write (create/rename/archive/
-- funding-mode change) goes through an RPC below so a browser role can
-- never forge a wallet's funding_mode or silently reassign it to another
-- user.
drop policy if exists purpose_wallets_select on public.purpose_wallets;
create policy purpose_wallets_select on public.purpose_wallets for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.purpose_wallets from public, anon, authenticated;
grant select on public.purpose_wallets to authenticated;

drop policy if exists purpose_wallet_movements_select on public.purpose_wallet_movements;
create policy purpose_wallet_movements_select on public.purpose_wallet_movements for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.purpose_wallet_movements from public, anon, authenticated;
grant select on public.purpose_wallet_movements to authenticated;

drop policy if exists transaction_purpose_allocations_select on public.transaction_purpose_allocations;
create policy transaction_purpose_allocations_select on public.transaction_purpose_allocations for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.transaction_purpose_allocations from public, anon, authenticated;
grant select on public.transaction_purpose_allocations to authenticated;

drop policy if exists income_allocation_plans_select on public.income_allocation_plans;
create policy income_allocation_plans_select on public.income_allocation_plans for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.income_allocation_plans from public, anon, authenticated;
grant select on public.income_allocation_plans to authenticated;

drop policy if exists income_allocation_plan_lines_select on public.income_allocation_plan_lines;
create policy income_allocation_plan_lines_select on public.income_allocation_plan_lines for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.income_allocation_plan_lines from public, anon, authenticated;
grant select on public.income_allocation_plan_lines to authenticated;

drop policy if exists income_allocation_applications_select on public.income_allocation_applications;
create policy income_allocation_applications_select on public.income_allocation_applications for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.income_allocation_applications from public, anon, authenticated;
grant select on public.income_allocation_applications to authenticated;

-- =======================================================================
-- 7. Shared helper: eligible liquid balance for one user/currency —
--    real, ledger-backed, non-investment, non-credit-card asset balance.
--    Used by both the allocation-limit check below and
--    get_safe_to_spend_summary later in this migration.
-- =======================================================================

create or replace function public.eligible_liquid_balance(p_user_id uuid, p_currency text)
returns numeric
language sql
security invoker
stable
as $$
  select coalesce(sum(b.display_balance), 0)::numeric(20, 4)
  from public.account_balances b
  join public.accounts a on a.id = b.account_id
  where b.user_id = p_user_id
    and b.currency = p_currency
    and a.is_archived = false
    and a.account_type in ('bank_savings', 'bank_current', 'cash', 'wallet', 'other_asset');
$$;

comment on function public.eligible_liquid_balance is
  'Real, ledger-backed liquid balance for one user/currency — excludes investment accounts, credit cards (a liability, not spendable cash) and archived accounts. The basis for both the earmarked-allocation ceiling and safe-to-spend.';

revoke all on function public.eligible_liquid_balance(uuid, text) from public, anon, authenticated;

-- Currently-earmarked total across a user's active, earmarked wallets for
-- one currency — the other half of the core invariant
-- "total purpose allocation <= eligible real account balance".
create or replace function public.total_earmarked_allocation(p_user_id uuid, p_currency text)
returns numeric
language sql
security invoker
stable
as $$
  select coalesce(sum(m.amount), 0)::numeric(20, 4)
  from public.purpose_wallet_movements m
  join public.purpose_wallets w on w.id = m.wallet_id
  where m.user_id = p_user_id
    and m.currency = p_currency
    and w.funding_mode = 'earmarked'
    and w.status = 'active';
$$;

revoke all on function public.total_earmarked_allocation(uuid, text) from public, anon, authenticated;

-- =======================================================================
-- 8. Purpose-wallet RPCs.
-- =======================================================================

create or replace function public.create_purpose_wallet(
  p_name text,
  p_currency text default 'INR',
  p_icon text default null,
  p_color text default null,
  p_description text default null,
  p_priority integer default 0,
  p_target_amount numeric default null,
  p_funding_mode text default 'earmarked'
)
returns public.purpose_wallets
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_wallet public.purpose_wallets;
begin
  if v_user_id is null then
    raise exception 'Sign in required' using errcode = '42501';
  end if;

  insert into public.purpose_wallets (
    user_id, name, icon, color, description, currency, priority, target_amount, funding_mode
  ) values (
    v_user_id, p_name, p_icon, p_color, p_description, p_currency, p_priority, p_target_amount, p_funding_mode
  )
  returning * into v_wallet;

  return v_wallet;
end;
$$;

revoke all on function public.create_purpose_wallet(text, text, text, text, text, integer, numeric, text) from public, anon;
grant execute on function public.create_purpose_wallet(text, text, text, text, text, integer, numeric, text) to authenticated;

create or replace function public.update_purpose_wallet(
  p_wallet_id uuid,
  p_name text default null,
  p_icon text default null,
  p_color text default null,
  p_description text default null,
  p_priority integer default null,
  p_target_amount numeric default null
)
returns public.purpose_wallets
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_wallet public.purpose_wallets;
begin
  if v_user_id is null then
    raise exception 'Sign in required' using errcode = '42501';
  end if;

  update public.purpose_wallets set
    name = coalesce(p_name, name),
    icon = coalesce(p_icon, icon),
    color = coalesce(p_color, color),
    description = coalesce(p_description, description),
    priority = coalesce(p_priority, priority),
    target_amount = coalesce(p_target_amount, target_amount)
  where id = p_wallet_id and user_id = v_user_id
  returning * into v_wallet;

  if v_wallet.id is null then
    raise exception 'Wallet not found' using errcode = '42501';
  end if;

  return v_wallet;
end;
$$;

revoke all on function public.update_purpose_wallet(uuid, text, text, text, text, integer, numeric) from public, anon, authenticated;
grant execute on function public.update_purpose_wallet(uuid, text, text, text, text, integer, numeric) to authenticated;

create or replace function public.set_purpose_wallet_archived(p_wallet_id uuid, p_archived boolean)
returns public.purpose_wallets
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_wallet public.purpose_wallets;
begin
  if v_user_id is null then
    raise exception 'Sign in required' using errcode = '42501';
  end if;

  update public.purpose_wallets set status = case when p_archived then 'archived' else 'active' end
  where id = p_wallet_id and user_id = v_user_id
  returning * into v_wallet;

  if v_wallet.id is null then
    raise exception 'Wallet not found' using errcode = '42501';
  end if;

  return v_wallet;
end;
$$;

revoke all on function public.set_purpose_wallet_archived(uuid, boolean) from public, anon, authenticated;
grant execute on function public.set_purpose_wallet_archived(uuid, boolean) to authenticated;

-- 8a. Earmark existing money into a wallet — the one non-reallocation way
-- a wallet's balance increases from nothing. For an 'earmarked' wallet
-- this can never push total earmarked allocation past eligible liquid
-- balance; a 'planning_only' wallet has no such ceiling (it is explicitly
-- unfunded by design).
create or replace function public.allocate_to_purpose_wallet(
  p_wallet_id uuid,
  p_amount numeric,
  p_memo text default null
)
returns public.purpose_wallet_movements
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_wallet public.purpose_wallets;
  v_eligible numeric;
  v_already_earmarked numeric;
  v_movement public.purpose_wallet_movements;
begin
  if v_user_id is null then
    raise exception 'Sign in required' using errcode = '42501';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Allocation amount must be positive' using errcode = '22023';
  end if;

  select * into v_wallet from public.purpose_wallets where id = p_wallet_id and user_id = v_user_id;
  if v_wallet.id is null then
    raise exception 'Wallet not found' using errcode = '42501';
  end if;
  if v_wallet.status <> 'active' then
    raise exception 'Cannot allocate to an archived wallet' using errcode = '22023';
  end if;

  if v_wallet.funding_mode = 'earmarked' then
    v_eligible := public.eligible_liquid_balance(v_user_id, v_wallet.currency);
    v_already_earmarked := public.total_earmarked_allocation(v_user_id, v_wallet.currency);
    if v_already_earmarked + p_amount > v_eligible then
      raise exception 'Allocation would exceed eligible liquid balance (% available, % already earmarked)',
        v_eligible, v_already_earmarked using errcode = '22023';
    end if;
  end if;

  insert into public.purpose_wallet_movements (user_id, wallet_id, movement_kind, amount, currency, memo)
  values (v_user_id, p_wallet_id, 'manual_allocation', p_amount, v_wallet.currency, p_memo)
  returning * into v_movement;

  return v_movement;
end;
$$;

revoke all on function public.allocate_to_purpose_wallet(uuid, numeric, text) from public, anon, authenticated;
grant execute on function public.allocate_to_purpose_wallet(uuid, numeric, text) to authenticated;

-- 8b. Release an allocation back to unallocated (the inverse of manual
-- allocation) — never creates a ledger transaction.
create or replace function public.release_purpose_wallet_allocation(
  p_wallet_id uuid,
  p_amount numeric,
  p_memo text default null
)
returns public.purpose_wallet_movements
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_wallet public.purpose_wallets;
  v_movement public.purpose_wallet_movements;
begin
  if v_user_id is null then
    raise exception 'Sign in required' using errcode = '42501';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Release amount must be positive' using errcode = '22023';
  end if;

  select * into v_wallet from public.purpose_wallets where id = p_wallet_id and user_id = v_user_id;
  if v_wallet.id is null then
    raise exception 'Wallet not found' using errcode = '42501';
  end if;

  insert into public.purpose_wallet_movements (user_id, wallet_id, movement_kind, amount, currency, memo)
  values (v_user_id, p_wallet_id, 'release', -p_amount, v_wallet.currency, p_memo)
  returning * into v_movement;

  return v_movement;
end;
$$;

revoke all on function public.release_purpose_wallet_allocation(uuid, numeric, text) from public, anon, authenticated;
grant execute on function public.release_purpose_wallet_allocation(uuid, numeric, text) to authenticated;

-- 8c. Move an allocation between two of the caller's own wallets — writes
-- two linked movement rows, creates no ledger transaction, and cannot
-- itself violate the earmarked ceiling (the total across both wallets is
-- unchanged by construction; only the per-wallet split moves).
create or replace function public.reallocate_purpose_wallet(
  p_from_wallet_id uuid,
  p_to_wallet_id uuid,
  p_amount numeric,
  p_memo text default null
)
returns table (from_movement public.purpose_wallet_movements, to_movement public.purpose_wallet_movements)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_from public.purpose_wallets;
  v_to public.purpose_wallets;
  v_group_id uuid;
  v_from_movement public.purpose_wallet_movements;
  v_to_movement public.purpose_wallet_movements;
  v_from_balance numeric;
begin
  if v_user_id is null then
    raise exception 'Sign in required' using errcode = '42501';
  end if;
  if p_from_wallet_id = p_to_wallet_id then
    raise exception 'Choose two different wallets' using errcode = '22023';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Reallocation amount must be positive' using errcode = '22023';
  end if;

  select * into v_from from public.purpose_wallets where id = p_from_wallet_id and user_id = v_user_id;
  select * into v_to from public.purpose_wallets where id = p_to_wallet_id and user_id = v_user_id;
  if v_from.id is null or v_to.id is null then
    raise exception 'Wallet not found' using errcode = '42501';
  end if;
  if v_from.status <> 'active' or v_to.status <> 'active' then
    raise exception 'Both wallets must be active' using errcode = '22023';
  end if;
  if v_from.currency <> v_to.currency then
    raise exception 'Both wallets must share the same currency' using errcode = '22023';
  end if;

  select coalesce(sum(amount), 0) into v_from_balance
  from public.purpose_wallet_movements where wallet_id = p_from_wallet_id;
  if v_from_balance - p_amount < 0 then
    raise exception 'Insufficient allocated balance in the source wallet (% available)', v_from_balance
      using errcode = '22023';
  end if;

  v_group_id := gen_random_uuid();

  insert into public.purpose_wallet_movements (
    user_id, wallet_id, movement_kind, amount, currency, counterparty_wallet_id, movement_group_id, memo
  ) values (
    v_user_id, p_from_wallet_id, 'reallocation_out', -p_amount, v_from.currency, p_to_wallet_id, v_group_id, p_memo
  )
  returning * into v_from_movement;

  insert into public.purpose_wallet_movements (
    user_id, wallet_id, movement_kind, amount, currency, counterparty_wallet_id, movement_group_id, memo
  ) values (
    v_user_id, p_to_wallet_id, 'reallocation_in', p_amount, v_to.currency, p_from_wallet_id, v_group_id, p_memo
  )
  returning * into v_to_movement;

  from_movement := v_from_movement;
  to_movement := v_to_movement;
  return next;
end;
$$;

revoke all on function public.reallocate_purpose_wallet(uuid, uuid, numeric, text) from public, anon, authenticated;
grant execute on function public.reallocate_purpose_wallet(uuid, uuid, numeric, text) to authenticated;

-- 8d. Assign an already-posted expense/credit-card-purchase transaction to
-- a purpose wallet. Never consumes a wallet twice for the same
-- transaction (transaction_purpose_allocations' unique index), and never
-- lets a credit-card *payment* consume a wallet a second time for the
-- same spending (only 'expense' and 'credit_card_purchase' transaction
-- types are accepted).
create or replace function public.assign_transaction_to_purpose_wallet(
  p_transaction_id uuid,
  p_wallet_id uuid
)
returns public.transaction_purpose_allocations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_txn public.ledger_transactions;
  v_wallet public.purpose_wallets;
  v_amount numeric;
  v_allocation public.transaction_purpose_allocations;
begin
  if v_user_id is null then
    raise exception 'Sign in required' using errcode = '42501';
  end if;

  select * into v_txn from public.ledger_transactions where id = p_transaction_id and user_id = v_user_id;
  if v_txn.id is null then
    raise exception 'Transaction not found' using errcode = '42501';
  end if;
  if v_txn.status <> 'posted' then
    raise exception 'Cannot assign a reversed transaction to a wallet' using errcode = '22023';
  end if;
  if v_txn.transaction_type not in ('expense', 'credit_card_purchase') then
    raise exception 'Only an expense or credit-card purchase can be assigned to a purpose wallet' using errcode = '22023';
  end if;
  if exists (select 1 from public.transaction_purpose_allocations where transaction_id = p_transaction_id) then
    raise exception 'This transaction is already assigned to a wallet' using errcode = '22023';
  end if;

  select * into v_wallet from public.purpose_wallets where id = p_wallet_id and user_id = v_user_id;
  if v_wallet.id is null then
    raise exception 'Wallet not found' using errcode = '42501';
  end if;
  if v_wallet.status <> 'active' then
    raise exception 'Cannot assign to an archived wallet' using errcode = '22023';
  end if;

  -- The transaction's own spend amount: the positive-sign entry on the
  -- non-system account it touched (the negative entry is the paired
  -- uncategorized_expense/credit-card leg) — mirrors how every other
  -- Phase 11/12 function reads "the meaningful amount" off an entries
  -- pair rather than trusting a client-supplied figure.
  select abs(e.amount) into v_amount
  from public.ledger_entries e
  join public.accounts a on a.id = e.account_id
  where e.transaction_id = p_transaction_id and a.is_system = false
  limit 1;

  if v_amount is null then
    raise exception 'Could not determine this transaction''s amount' using errcode = '22023';
  end if;

  insert into public.transaction_purpose_allocations (user_id, transaction_id, wallet_id, amount)
  values (v_user_id, p_transaction_id, p_wallet_id, v_amount)
  returning * into v_allocation;

  insert into public.purpose_wallet_movements (
    user_id, wallet_id, movement_kind, amount, currency, related_transaction_id
  ) values (
    v_user_id, p_wallet_id, 'expense_spend', -v_amount, v_wallet.currency, p_transaction_id
  );

  return v_allocation;
end;
$$;

revoke all on function public.assign_transaction_to_purpose_wallet(uuid, uuid) from public, anon, authenticated;
grant execute on function public.assign_transaction_to_purpose_wallet(uuid, uuid) to authenticated;

create or replace function public.unassign_transaction_purpose_wallet(p_transaction_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_allocation public.transaction_purpose_allocations;
begin
  if v_user_id is null then
    raise exception 'Sign in required' using errcode = '42501';
  end if;

  select * into v_allocation from public.transaction_purpose_allocations
    where transaction_id = p_transaction_id and user_id = v_user_id;
  if v_allocation.id is null then
    raise exception 'This transaction is not assigned to a wallet' using errcode = '42501';
  end if;

  insert into public.purpose_wallet_movements (
    user_id, wallet_id, movement_kind, amount, currency, related_transaction_id, memo
  )
  select v_user_id, v_allocation.wallet_id, 'expense_reversal', v_allocation.amount, w.currency, p_transaction_id, 'Unassigned from wallet'
  from public.purpose_wallets w where w.id = v_allocation.wallet_id;

  delete from public.transaction_purpose_allocations where id = v_allocation.id;
end;
$$;

revoke all on function public.unassign_transaction_purpose_wallet(uuid) from public, anon, authenticated;
grant execute on function public.unassign_transaction_purpose_wallet(uuid) to authenticated;

-- =======================================================================
-- 9. Reversal-safety trigger — restores (and, for an edit-replacement,
--    re-applies at the corrected amount) a transaction's wallet
--    assignment when the *existing*, untouched reversal/edit workflow
--    posts a new row with reversal_of or replaces_transaction_id set.
--    This is the only place this migration ever writes in response to
--    ledger_transactions changing — it never posts, edits, or reverses a
--    transaction itself.
-- =======================================================================

create or replace function public.restore_purpose_wallet_on_transaction_reversal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_original_id uuid;
  v_allocation public.transaction_purpose_allocations;
  v_new_amount numeric;
begin
  v_original_id := coalesce(new.reversal_of, new.replaces_transaction_id);
  if v_original_id is null then
    return new;
  end if;

  select * into v_allocation from public.transaction_purpose_allocations where transaction_id = v_original_id;
  if v_allocation.id is null then
    return new;
  end if;

  -- Restore the wallet balance the original transaction had consumed.
  insert into public.purpose_wallet_movements (
    user_id, wallet_id, movement_kind, amount, currency, related_transaction_id, memo
  )
  select v_allocation.user_id, v_allocation.wallet_id, 'expense_reversal', v_allocation.amount, w.currency, new.id,
    case when new.reversal_of is not null then 'Restored by reversal' else 'Restored by edit' end
  from public.purpose_wallets w where w.id = v_allocation.wallet_id;

  delete from public.transaction_purpose_allocations where id = v_allocation.id;

  -- An edit-replacement (not a pure reversal) carries the same purpose-
  -- wallet assignment forward at the new transaction's own amount, so
  -- correcting an expense's amount doesn't silently drop its wallet tag.
  if new.replaces_transaction_id is not null and new.status = 'posted' then
    select abs(e.amount) into v_new_amount
    from public.ledger_entries e
    join public.accounts a on a.id = e.account_id
    where e.transaction_id = new.id and a.is_system = false
    limit 1;

    if v_new_amount is not null then
      insert into public.transaction_purpose_allocations (user_id, transaction_id, wallet_id, amount)
      values (v_allocation.user_id, new.id, v_allocation.wallet_id, v_new_amount);

      insert into public.purpose_wallet_movements (
        user_id, wallet_id, movement_kind, amount, currency, related_transaction_id, memo
      )
      select v_allocation.user_id, v_allocation.wallet_id, 'expense_spend', -v_new_amount, w.currency, new.id, 'Re-applied after edit'
      from public.purpose_wallets w where w.id = v_allocation.wallet_id;
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.restore_purpose_wallet_on_transaction_reversal() from public, anon, authenticated;

drop trigger if exists restore_purpose_wallet_on_reversal on public.ledger_transactions;
create trigger restore_purpose_wallet_on_reversal
  after insert on public.ledger_transactions
  for each row
  execute function public.restore_purpose_wallet_on_transaction_reversal();

-- =======================================================================
-- 10. Income-allocation-plan RPCs.
-- =======================================================================

create or replace function public.save_income_allocation_plan(
  p_name text,
  p_allocation_mode text,
  p_effective_date date,
  p_lines jsonb,
  p_plan_id uuid default null,
  p_trigger_category_id uuid default null,
  p_trigger_payee_id uuid default null,
  p_trigger_account_id uuid default null,
  p_currency text default 'INR',
  p_end_date date default null
)
returns public.income_allocation_plans
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_plan public.income_allocation_plans;
  v_line jsonb;
  v_percentage_total numeric := 0;
  v_line_count integer := 0;
begin
  if v_user_id is null then
    raise exception 'Sign in required' using errcode = '42501';
  end if;
  if jsonb_array_length(p_lines) = 0 then
    raise exception 'A plan needs at least one allocation line' using errcode = '22023';
  end if;

  if p_allocation_mode = 'percentage' then
    for v_line in select * from jsonb_array_elements(p_lines)
    loop
      v_percentage_total := v_percentage_total + coalesce((v_line ->> 'percentage')::numeric, 0);
      v_line_count := v_line_count + 1;
    end loop;
    if v_percentage_total <> 100 then
      raise exception 'Percentage allocation lines must total exactly 100%% (got %)', v_percentage_total
        using errcode = '22023';
    end if;
  end if;

  if p_plan_id is not null then
    update public.income_allocation_plans set
      name = p_name,
      allocation_mode = p_allocation_mode,
      trigger_category_id = p_trigger_category_id,
      trigger_payee_id = p_trigger_payee_id,
      trigger_account_id = p_trigger_account_id,
      currency = p_currency,
      effective_date = p_effective_date,
      end_date = p_end_date
    where id = p_plan_id and user_id = v_user_id
    returning * into v_plan;

    if v_plan.id is null then
      raise exception 'Plan not found' using errcode = '42501';
    end if;

    delete from public.income_allocation_plan_lines where plan_id = p_plan_id;
  else
    insert into public.income_allocation_plans (
      user_id, name, allocation_mode, trigger_category_id, trigger_payee_id, trigger_account_id,
      currency, effective_date, end_date
    ) values (
      v_user_id, p_name, p_allocation_mode, p_trigger_category_id, p_trigger_payee_id, p_trigger_account_id,
      p_currency, p_effective_date, p_end_date
    )
    returning * into v_plan;
  end if;

  insert into public.income_allocation_plan_lines (
    user_id, plan_id, wallet_id, line_order, percentage, fixed_amount
  )
  select
    v_user_id,
    v_plan.id,
    (line ->> 'wallet_id')::uuid,
    coalesce((line ->> 'line_order')::integer, 0),
    nullif(line ->> 'percentage', '')::numeric,
    nullif(line ->> 'fixed_amount', '')::numeric
  from jsonb_array_elements(p_lines) as line;

  return v_plan;
end;
$$;

revoke all on function public.save_income_allocation_plan(text, text, date, jsonb, uuid, uuid, uuid, uuid, text, date) from public, anon, authenticated;
grant execute on function public.save_income_allocation_plan(text, text, date, jsonb, uuid, uuid, uuid, uuid, text, date) to authenticated;

create or replace function public.set_income_allocation_plan_status(p_plan_id uuid, p_status text)
returns public.income_allocation_plans
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_plan public.income_allocation_plans;
begin
  if v_user_id is null then
    raise exception 'Sign in required' using errcode = '42501';
  end if;
  if p_status not in ('active', 'paused', 'archived') then
    raise exception 'Invalid status' using errcode = '22023';
  end if;

  update public.income_allocation_plans set status = p_status
  where id = p_plan_id and user_id = v_user_id
  returning * into v_plan;

  if v_plan.id is null then
    raise exception 'Plan not found' using errcode = '42501';
  end if;

  return v_plan;
end;
$$;

revoke all on function public.set_income_allocation_plan_status(uuid, text) from public, anon, authenticated;
grant execute on function public.set_income_allocation_plan_status(uuid, text) to authenticated;

-- 10a. Apply one plan to one already-posted income transaction. Fixed
-- lines are applied first (capped at whatever remains of the income
-- amount), then percentage lines split whatever remains after fixed
-- lines — the documented hybrid-mode order. Never allocates more than
-- the transaction's own amount; whatever is left is the visible
-- unallocated remainder, never silently dropped or forced to zero.
create or replace function public.apply_income_allocation_plan_to_transaction(
  p_plan_id uuid,
  p_transaction_id uuid
)
returns public.income_allocation_applications
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_plan public.income_allocation_plans;
  v_txn public.ledger_transactions;
  v_income_amount numeric;
  v_remaining numeric;
  v_allocated_total numeric := 0;
  v_line record;
  v_line_amount numeric;
  v_application public.income_allocation_applications;
begin
  if v_user_id is null then
    raise exception 'Sign in required' using errcode = '42501';
  end if;

  select * into v_plan from public.income_allocation_plans where id = p_plan_id and user_id = v_user_id;
  if v_plan.id is null then
    raise exception 'Plan not found' using errcode = '42501';
  end if;
  if v_plan.status <> 'active' then
    raise exception 'Plan is not active' using errcode = '22023';
  end if;

  select * into v_txn from public.ledger_transactions where id = p_transaction_id and user_id = v_user_id;
  if v_txn.id is null then
    raise exception 'Transaction not found' using errcode = '42501';
  end if;
  if v_txn.transaction_type <> 'income' then
    raise exception 'Only an income transaction can have an allocation plan applied' using errcode = '22023';
  end if;
  if v_txn.status <> 'posted' then
    raise exception 'Cannot apply a plan to a reversed transaction' using errcode = '22023';
  end if;

  select abs(e.amount) into v_income_amount
  from public.ledger_entries e
  join public.accounts a on a.id = e.account_id
  where e.transaction_id = p_transaction_id and a.is_system = false
  limit 1;
  if v_income_amount is null then
    raise exception 'Could not determine this transaction''s amount' using errcode = '22023';
  end if;

  -- The application row is created first, with placeholder totals, so
  -- every movement row inserted below can reference its real id directly
  -- — no need to retroactively match rows back to this application by a
  -- time window (which could mis-tag an unrelated concurrent allocation
  -- from the same user).
  insert into public.income_allocation_applications (
    user_id, plan_id, transaction_id, allocated_total, unallocated_remainder
  ) values (
    v_user_id, p_plan_id, p_transaction_id, 0, v_income_amount
  )
  returning * into v_application;

  v_remaining := v_income_amount;

  -- Fixed-amount lines first (percentage-mode plans have none).
  for v_line in
    select * from public.income_allocation_plan_lines
    where plan_id = p_plan_id and fixed_amount is not null
    order by line_order
  loop
    v_line_amount := least(v_line.fixed_amount, v_remaining);
    if v_line_amount > 0 then
      insert into public.purpose_wallet_movements (
        user_id, wallet_id, movement_kind, amount, currency, related_income_application_id, memo
      )
      select v_user_id, v_line.wallet_id, 'income_plan_allocation', v_line_amount, w.currency, v_application.id, 'Income allocation plan: ' || v_plan.name
      from public.purpose_wallets w where w.id = v_line.wallet_id;

      v_remaining := v_remaining - v_line_amount;
      v_allocated_total := v_allocated_total + v_line_amount;
    end if;
  end loop;

  -- Percentage lines split whatever remains after fixed lines (for a
  -- pure percentage-mode plan, "remaining" is still the full amount).
  for v_line in
    select * from public.income_allocation_plan_lines
    where plan_id = p_plan_id and percentage is not null
    order by line_order
  loop
    v_line_amount := least(round(v_income_amount * v_line.percentage / 100, 4), v_remaining);
    if v_line_amount > 0 then
      insert into public.purpose_wallet_movements (
        user_id, wallet_id, movement_kind, amount, currency, related_income_application_id, memo
      )
      select v_user_id, v_line.wallet_id, 'income_plan_allocation', v_line_amount, w.currency, v_application.id, 'Income allocation plan: ' || v_plan.name
      from public.purpose_wallets w where w.id = v_line.wallet_id;

      v_remaining := v_remaining - v_line_amount;
      v_allocated_total := v_allocated_total + v_line_amount;
    end if;
  end loop;

  update public.income_allocation_applications
  set allocated_total = v_allocated_total, unallocated_remainder = v_remaining
  where id = v_application.id
  returning * into v_application;

  return v_application;
end;
$$;

revoke all on function public.apply_income_allocation_plan_to_transaction(uuid, uuid) from public, anon, authenticated;
grant execute on function public.apply_income_allocation_plan_to_transaction(uuid, uuid) to authenticated;

comment on function public.apply_income_allocation_plan_to_transaction is
  'Idempotent per (plan, transaction) via income_allocation_applications'' unique constraint — a duplicate call raises a unique-violation rather than double-allocating. Reversing the income transaction reverses every wallet movement this created (see reverse_income_allocation_application).';

-- 10b. Explicit reversal, also invoked automatically when the underlying
-- income transaction is reversed (see the trigger below).
create or replace function public.reverse_income_allocation_application(p_application_id uuid)
returns public.income_allocation_applications
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_application public.income_allocation_applications;
begin
  if v_user_id is null then
    raise exception 'Sign in required' using errcode = '42501';
  end if;

  select * into v_application from public.income_allocation_applications
    where id = p_application_id and user_id = v_user_id;
  if v_application.id is null then
    raise exception 'Application not found' using errcode = '42501';
  end if;
  if v_application.status = 'reversed' then
    return v_application;
  end if;

  insert into public.purpose_wallet_movements (
    user_id, wallet_id, movement_kind, amount, currency, related_income_application_id, memo
  )
  select v_user_id, m.wallet_id, 'release', -m.amount, m.currency, v_application.id, 'Income allocation reversed'
  from public.purpose_wallet_movements m
  where m.related_income_application_id = v_application.id and m.movement_kind = 'income_plan_allocation';

  update public.income_allocation_applications set status = 'reversed', reversed_at = now()
  where id = p_application_id
  returning * into v_application;

  return v_application;
end;
$$;

revoke all on function public.reverse_income_allocation_application(uuid) from public, anon, authenticated;
grant execute on function public.reverse_income_allocation_application(uuid) to authenticated;

create or replace function public.reverse_income_allocations_on_transaction_reversal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_application_id uuid;
begin
  if new.reversal_of is null then
    return new;
  end if;

  for v_application_id in
    select id from public.income_allocation_applications
    where transaction_id = new.reversal_of and status = 'applied'
  loop
    perform public.reverse_income_allocation_application(v_application_id);
  end loop;

  return new;
end;
$$;

revoke all on function public.reverse_income_allocations_on_transaction_reversal() from public, anon, authenticated;

drop trigger if exists reverse_income_allocations_on_reversal on public.ledger_transactions;
create trigger reverse_income_allocations_on_reversal
  after insert on public.ledger_transactions
  for each row
  execute function public.reverse_income_allocations_on_transaction_reversal();

-- =======================================================================
-- 11. Safe-to-spend summary.
-- =======================================================================

create or replace function public.get_safe_to_spend_summary(p_currency text default 'INR')
returns table (
  currency text,
  eligible_liquid_balance numeric,
  earmarked_allocation numeric,
  near_term_commitments numeric,
  safe_to_spend numeric,
  as_of timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_eligible numeric;
  v_earmarked numeric;
  v_commitments numeric;
begin
  if v_user_id is null then
    raise exception 'Sign in required' using errcode = '42501';
  end if;

  v_eligible := public.eligible_liquid_balance(v_user_id, p_currency);
  v_earmarked := public.total_earmarked_allocation(v_user_id, p_currency);

  -- Near-term mandatory commitments: recurring occurrences already due or
  -- overdue for this user/currency — a real, already-scheduled figure,
  -- never a fabricated one.
  select coalesce(sum(o.amount), 0) into v_commitments
  from public.recurring_occurrences o
  join public.recurring_items i on i.id = o.recurring_item_id
  where o.user_id = v_user_id
    and o.currency = p_currency
    and o.status in ('due', 'overdue')
    and i.kind in ('bill', 'subscription');

  currency := p_currency;
  eligible_liquid_balance := v_eligible;
  earmarked_allocation := v_earmarked;
  near_term_commitments := v_commitments;
  safe_to_spend := greatest(v_eligible - v_earmarked - v_commitments, 0);
  as_of := now();
  return next;
end;
$$;

comment on function public.get_safe_to_spend_summary is
  'An explainable estimate, never a bank balance: eligible liquid balance minus earmarked purpose-wallet allocations minus near-term mandatory commitments (due/overdue bills and subscriptions). Never negative — a shortfall shows as safe_to_spend = 0 with the caller expected to compare eligible_liquid_balance against the other two components to see why.';

revoke all on function public.get_safe_to_spend_summary(text) from public, anon;
grant execute on function public.get_safe_to_spend_summary(text) to authenticated;
