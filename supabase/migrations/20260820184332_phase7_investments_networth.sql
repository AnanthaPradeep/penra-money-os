-- Phase 7: net worth, investment accounts, manual holdings, and
-- fixed-income (PPF/FD/RD) tracking.
--
-- Scope: a normalized, manually-entered investment model
-- (investment_assets / investment_holdings / investment_activities /
-- investment_valuations / fixed_income_details) built entirely on top of
-- the existing Phase 3 double-entry ledger and Phase 6 recurring
-- infrastructure — neither introduces a second source of financial truth.
-- Every cash-moving investment activity posts through the exact same
-- trusted posting core Phase 6 already extracted
-- (post_manual_transaction_for_user) — never a parallel/weaker
-- re-implementation. No live prices, no market-data providers, no broker
-- APIs, no bank sync, no CSV import, no cryptocurrency. Every "current
-- value" in this schema is either a ledger-derived cost basis or a
-- dated, user-entered manual valuation — never fabricated.
--
-- Cost-basis method: weighted-average, applied uniformly across every
-- asset kind (stock/mutual_fund/ppf/fixed_deposit/recurring_deposit/
-- other_investment). A holding's running quantity and remaining cost
-- basis are never stored as an independently mutable field — both are
-- always replayed from the immutable investment_activities history (see
-- public.investment_holding_position, section 9). Buy-side fees are
-- included in cost basis (increase it); sell-side fees/taxes reduce net
-- proceeds (and therefore realized gain) but never change the cost basis
-- consumed; a standalone fee activity (not tied to a specific buy/sell)
-- never touches cost basis at all — it is pure expense. This is the one
-- documented fee-treatment rule referenced throughout this file and its
-- tests.

-- =======================================================================
-- 1. Widen public.accounts: a new user-creatable 'investment' type, and
--    a new hidden system account for realized investment gains/losses.
-- =======================================================================
-- Purely additive (superset) CHECK-constraint changes — no existing row
-- can violate a widened list, so this is safe to apply without touching
-- Phase 1-6 data. 'investment' lets a user classify a brokerage/demat/
-- PPF/FD/RD "container" using the *existing* account model (create it via
-- the same /app/accounts/new flow every other account type already uses)
-- rather than inventing a parallel account concept.

alter table public.accounts drop constraint if exists accounts_type_valid;
alter table public.accounts add constraint accounts_type_valid check (
  account_type in (
    'bank_savings', 'bank_current', 'cash', 'wallet', 'credit_card', 'loan',
    'other_asset', 'other_liability', 'investment',
    'opening_balance_equity', 'uncategorized_income', 'uncategorized_expense',
    'realized_investment_gains'
  )
);

alter table public.accounts drop constraint if exists accounts_class_type_match;
alter table public.accounts add constraint accounts_class_type_match check (
  (account_type in ('bank_savings', 'bank_current', 'cash', 'wallet', 'other_asset', 'investment')
    and account_class = 'asset')
  or (account_type in ('credit_card', 'loan', 'other_liability')
    and account_class = 'liability')
  or (account_type = 'opening_balance_equity' and account_class = 'equity')
  or (account_type in ('uncategorized_income', 'realized_investment_gains')
    and account_class = 'income')
  or (account_type = 'uncategorized_expense' and account_class = 'expense')
);

alter table public.accounts drop constraint if exists accounts_system_code_valid;
alter table public.accounts add constraint accounts_system_code_valid check (
  system_code is null
  or system_code in (
    'opening_balance_equity', 'uncategorized_income', 'uncategorized_expense',
    'realized_investment_gains'
  )
);

-- Widen the two Phase 3 system-account provisioning functions (create or
-- replace, identical signatures) to also provision the new system account
-- for every user, plus a one-time backfill for existing users — mirrors
-- section 7 of the ledger-foundation migration exactly.

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
    (v_user_id, 'Uncategorized Expense', 'expense', 'uncategorized_expense', 'INR', true, 'uncategorized_expense'),
    (v_user_id, 'Realized Investment Gains/Losses', 'income', 'realized_investment_gains', 'INR', true, 'realized_investment_gains')
  on conflict (user_id, system_code) where is_system = true do nothing;
end;
$$;

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
    (new.id, 'Uncategorized Expense', 'expense', 'uncategorized_expense', 'INR', true, 'uncategorized_expense'),
    (new.id, 'Realized Investment Gains/Losses', 'income', 'realized_investment_gains', 'INR', true, 'realized_investment_gains')
  on conflict (user_id, system_code) where is_system = true do nothing;

  return new;
end;
$$;

-- Backfill for users created before this migration.
insert into public.accounts (
  user_id, name, account_class, account_type, currency, is_system, system_code
)
select u.id, 'Realized Investment Gains/Losses', 'income', 'realized_investment_gains', 'INR', true, 'realized_investment_gains'
from auth.users u
on conflict (user_id, system_code) where is_system = true do nothing;

-- Widen create_account_with_opening_balance's account_type -> class
-- derivation (create or replace, identical signature) so a user can
-- create an 'investment' account through the existing account-creation
-- RPC, with an optional opening balance posted exactly like any other
-- asset account.
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
    when 'investment' then 'asset'
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

-- =======================================================================
-- 2. Widen public.ledger_transactions: new investment transaction types.
-- =======================================================================
-- Dividends/interest reuse the existing 'income' type (posted with a real
-- income category, per section 11) and standalone fees reuse 'expense' —
-- neither needs a new type. Only the four asset<->asset/cash movements
-- that have no existing equivalent get a new type, purely for readable
-- transaction-history labelling; the ledger invariants (balance, currency,
-- ownership) are enforced identically regardless of transaction_type.

alter table public.ledger_transactions drop constraint if exists ledger_transactions_type_valid;
alter table public.ledger_transactions add constraint ledger_transactions_type_valid check (
  transaction_type in (
    'opening_balance', 'income', 'expense', 'transfer',
    'credit_card_purchase', 'credit_card_payment', 'adjustment', 'reversal',
    'investment_buy', 'investment_sell', 'investment_contribution',
    'investment_withdrawal', 'investment_maturity'
  )
);

create or replace function public.post_manual_transaction_for_user(
  p_user_id uuid,
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
  v_transaction public.ledger_transactions;
  v_entry jsonb;
begin
  if p_user_id is null then
    raise exception 'post_manual_transaction_for_user requires a user id'
      using errcode = 'invalid_parameter_value';
  end if;

  if p_transaction_type not in (
    'income', 'expense', 'transfer', 'credit_card_purchase', 'credit_card_payment', 'adjustment',
    'investment_buy', 'investment_sell', 'investment_contribution',
    'investment_withdrawal', 'investment_maturity'
  ) then
    raise exception 'unsupported manual transaction_type: %', p_transaction_type
      using errcode = 'invalid_parameter_value';
  end if;

  if jsonb_typeof(p_entries) <> 'array' or jsonb_array_length(p_entries) < 2 then
    raise exception 'p_entries must be a JSON array with at least two entries'
      using errcode = 'invalid_parameter_value';
  end if;

  insert into public.ledger_transactions (
    user_id, transaction_type, occurred_at, description, notes, source_type,
    source_reference, category_id, payee_id
  )
  values (
    p_user_id, p_transaction_type, p_occurred_at, p_description, p_notes, 'manual',
    p_idempotency_key, p_category_id, p_payee_id
  )
  on conflict (user_id, source_reference) where source_reference is not null
  do nothing
  returning * into v_transaction;

  if v_transaction.id is null then
    if p_idempotency_key is null then
      raise exception 'post_manual_transaction_for_user: insert unexpectedly produced no row'
        using errcode = 'data_exception';
    end if;

    select * into v_transaction
      from public.ledger_transactions
      where user_id = p_user_id and source_reference = p_idempotency_key;

    return v_transaction;
  end if;

  for v_entry in select * from jsonb_array_elements(p_entries)
  loop
    insert into public.ledger_entries (user_id, transaction_id, account_id, amount, currency, memo)
    values (
      p_user_id,
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

comment on function public.post_manual_transaction_for_user is
  'Shared posting core (Phase 6) — widened in Phase 7 to also accept the '
  'investment_* transaction types. Reachable by an authenticated client '
  'only through create_manual_transaction/post_occurrence_payment, exactly '
  'as flexible as any other manual transaction type already was; the '
  'record_investment_* functions (section 11) are the only application '
  'code paths that use these types, always paired with a matching '
  'investment_activities row.';

-- =======================================================================
-- 3. public.investment_assets
-- =======================================================================
-- Descriptive metadata for something the user owns or is tracking —
-- symbol/exchange/isin/scheme_code are plain user-entered text with no
-- external lookup, ever. No shared catalogue: every asset is per-user,
-- exactly like Phase 3's institutions.

create table if not exists public.investment_assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  asset_kind text not null,
  display_name text not null,
  symbol text null,
  exchange text null,
  isin text null,
  scheme_code text null,
  currency text not null default 'INR',
  unit_precision integer not null default 4,
  investment_account_id uuid null references public.accounts (id) on delete set null,
  status text not null default 'active',
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint investment_assets_kind_valid check (
    asset_kind in ('stock', 'mutual_fund', 'ppf', 'fixed_deposit', 'recurring_deposit', 'other_investment')
  ),
  constraint investment_assets_status_valid check (status in ('active', 'archived')),
  constraint investment_assets_display_name_length check (
    char_length(btrim(display_name)) between 1 and 160
  ),
  constraint investment_assets_symbol_length check (symbol is null or char_length(symbol) <= 40),
  constraint investment_assets_exchange_length check (exchange is null or char_length(exchange) <= 40),
  constraint investment_assets_isin_length check (isin is null or char_length(isin) <= 20),
  constraint investment_assets_scheme_code_length check (scheme_code is null or char_length(scheme_code) <= 40),
  constraint investment_assets_currency_format check (currency ~ '^[A-Z]{3}$'),
  constraint investment_assets_unit_precision_range check (unit_precision between 0 and 6),
  constraint investment_assets_notes_length check (notes is null or char_length(notes) <= 2000)
);

comment on table public.investment_assets is
  'User-owned, manually-described investable things (a stock, a mutual '
  'fund, a PPF/FD/RD product, or another investment). symbol/exchange/'
  'isin/scheme_code are descriptive metadata only — never used to fetch a '
  'live price. No shared catalogue, exactly like public.institutions.';

-- Duplicate-prevention: a strong identifier match (ISIN) always dedupes;
-- otherwise the same kind+name pair for one user is almost certainly a
-- re-entry mistake. Both are partial unique indexes so distinct kinds (a
-- "HDFC Bank" stock and a same-named "HDFC Bank" fixed deposit) never
-- collide.
create unique index if not exists investment_assets_user_isin_unique
  on public.investment_assets (user_id, upper(isin))
  where isin is not null;
create unique index if not exists investment_assets_user_kind_name_unique
  on public.investment_assets (user_id, asset_kind, lower(btrim(display_name)));

drop trigger if exists set_investment_assets_updated_at on public.investment_assets;
create trigger set_investment_assets_updated_at
  before update on public.investment_assets
  for each row
  execute function public.set_updated_at();

-- Ownership + type consistency for the optional linked investment
-- account: must belong to the same user and be an 'investment'-typed
-- account (never a bank/credit-card/etc. account mistakenly linked here).
create or replace function public.validate_investment_asset()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_acct_user_id uuid;
  v_acct_type text;
begin
  if new.investment_account_id is not null then
    select user_id, account_type into v_acct_user_id, v_acct_type
      from public.accounts
      where id = new.investment_account_id;

    if v_acct_user_id is null then
      raise exception 'investment asset references a non-existent account'
        using errcode = 'foreign_key_violation';
    end if;
    if v_acct_user_id <> new.user_id then
      raise exception 'investment asset account owner does not match asset owner'
        using errcode = 'insufficient_privilege';
    end if;
    if v_acct_type <> 'investment' then
      raise exception 'investment asset must link to an investment-type account'
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.validate_investment_asset() from public, anon, authenticated;

drop trigger if exists investment_assets_validate on public.investment_assets;
create trigger investment_assets_validate
  before insert or update on public.investment_assets
  for each row
  execute function public.validate_investment_asset();

-- =======================================================================
-- 4. public.investment_holdings
-- =======================================================================
-- A position in an asset. investment_account_id is nullable at the table
-- level (a pure valuation-only "other_investment" with no cash-flow
-- history is a legitimate use case) but is required in practice by every
-- function that posts a ledger-moving activity (section 11) — enforced
-- there with a clear error, not by a NOT NULL constraint here.

create table if not exists public.investment_holdings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  investment_asset_id uuid not null references public.investment_assets (id) on delete restrict,
  investment_account_id uuid null references public.accounts (id) on delete set null,
  currency text not null default 'INR',
  opened_date date not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint investment_holdings_status_valid check (status in ('active', 'archived')),
  constraint investment_holdings_currency_format check (currency ~ '^[A-Z]{3}$')
);

comment on table public.investment_holdings is
  'The user''s position in one investment_assets row. Quantity and cost '
  'basis are never stored here — always replayed from investment_activities '
  '(see public.investment_holding_position, section 9) so history is the '
  'single source of truth, not a mutable running total.';

drop trigger if exists set_investment_holdings_updated_at on public.investment_holdings;
create trigger set_investment_holdings_updated_at
  before update on public.investment_holdings
  for each row
  execute function public.set_updated_at();

create or replace function public.validate_investment_holding()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_asset_user_id uuid;
  v_acct_user_id uuid;
  v_acct_type text;
begin
  select user_id into v_asset_user_id
    from public.investment_assets
    where id = new.investment_asset_id;

  if v_asset_user_id is null then
    raise exception 'investment holding references a non-existent asset'
      using errcode = 'foreign_key_violation';
  end if;
  if v_asset_user_id <> new.user_id then
    raise exception 'investment holding asset owner does not match holding owner'
      using errcode = 'insufficient_privilege';
  end if;

  if new.investment_account_id is not null then
    select user_id, account_type into v_acct_user_id, v_acct_type
      from public.accounts
      where id = new.investment_account_id;

    if v_acct_user_id is null then
      raise exception 'investment holding references a non-existent account'
        using errcode = 'foreign_key_violation';
    end if;
    if v_acct_user_id <> new.user_id then
      raise exception 'investment holding account owner does not match holding owner'
        using errcode = 'insufficient_privilege';
    end if;
    if v_acct_type <> 'investment' then
      raise exception 'investment holding must link to an investment-type account'
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.validate_investment_holding() from public, anon, authenticated;

drop trigger if exists investment_holdings_validate on public.investment_holdings;
create trigger investment_holdings_validate
  before insert or update on public.investment_holdings
  for each row
  execute function public.validate_investment_holding();

-- =======================================================================
-- 5. public.investment_activities
-- =======================================================================
-- Immutable, append-only. A correction is made by reversing an activity
-- (section 11h) — never by UPDATE/DELETE of a posted row (enforced by
-- trigger below, mirroring public.prevent_ledger_entry_mutation).

create table if not exists public.investment_activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  holding_id uuid not null references public.investment_holdings (id) on delete restrict,
  activity_kind text not null,
  trade_date date not null,
  settlement_date date null,
  quantity numeric(20, 6) null,
  unit_price numeric(20, 6) null,
  gross_amount numeric(20, 4) not null,
  fee_amount numeric(20, 4) not null default 0,
  tax_amount numeric(20, 4) not null default 0,
  -- Sell: cost basis consumed by this disposal. Maturity: remaining cost
  -- basis removed at closeout. Adjustment: a signed cost-basis correction
  -- delta. Unused (null) for buy/contribution/withdrawal/dividend/
  -- interest/fee — see public.investment_holding_position (section 9).
  cost_basis_amount numeric(20, 4) null,
  -- Sell only: gross_amount - fee_amount - tax_amount - cost_basis_amount,
  -- stored at record-time since later buys would otherwise change the
  -- weighted-average cost retroactively if this were recomputed live.
  realized_gain_amount numeric(20, 4) null,
  currency text not null default 'INR',
  category_id uuid null references public.categories (id),
  payee_id uuid null references public.payees (id),
  ledger_transaction_id uuid null references public.ledger_transactions (id),
  idempotency_key text null,
  notes text null,
  status text not null default 'posted',
  reversal_of uuid null references public.investment_activities (id),
  reversed_by uuid null references public.investment_activities (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint investment_activities_kind_valid check (
    activity_kind in (
      'buy', 'sell', 'contribution', 'withdrawal', 'dividend', 'interest',
      'fee', 'maturity', 'adjustment'
    )
  ),
  constraint investment_activities_status_valid check (status in ('posted', 'reversed')),
  constraint investment_activities_currency_format check (currency ~ '^[A-Z]{3}$'),
  -- gross_amount/fee_amount/tax_amount/quantity are deliberately NOT
  -- constrained to be non-negative here: a reversal row (section 11h)
  -- stores the exact negation of its original so the pair nets to zero in
  -- public.investment_holding_position, and an adjustment's quantity/
  -- cost-basis delta can legitimately be a negative correction. Every
  -- user-facing record_* function (section 11) validates its own inputs
  -- are positive before ever reaching this table — exactly the same
  -- "table allows it, the trusted function enforces it" split
  -- ledger_transactions/ledger_entries already uses.
  constraint investment_activities_unit_price_positive check (unit_price is null or unit_price > 0),
  constraint investment_activities_notes_length check (notes is null or char_length(notes) <= 2000),
  constraint investment_activities_no_self_reversal check (reversal_of is null or reversal_of <> id)
);

comment on table public.investment_activities is
  'Immutable history of everything that happened to a holding — the sole '
  'source of truth for quantity and cost basis (see '
  'public.investment_holding_position, section 9). Never physically '
  'deleted or edited; a correction reverses an activity (section 11h) '
  'exactly like public.reverse_transaction does for ledger transactions.';

-- Idempotency: retrying the same logical activity (e.g. a dropped-response
-- retry from the client) never creates a duplicate. Scoped per user,
-- exactly like ledger_transactions_source_reference_unique.
create unique index if not exists investment_activities_user_idempotency_unique
  on public.investment_activities (user_id, idempotency_key)
  where idempotency_key is not null;
create unique index if not exists investment_activities_reversal_of_unique
  on public.investment_activities (reversal_of)
  where reversal_of is not null;

drop trigger if exists set_investment_activities_updated_at on public.investment_activities;
create trigger set_investment_activities_updated_at
  before update on public.investment_activities
  for each row
  execute function public.set_updated_at();

create or replace function public.validate_investment_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_holding_user_id uuid;
begin
  select user_id into v_holding_user_id
    from public.investment_holdings
    where id = new.holding_id;

  if v_holding_user_id is null then
    raise exception 'investment activity references a non-existent holding'
      using errcode = 'foreign_key_violation';
  end if;
  if v_holding_user_id <> new.user_id then
    raise exception 'investment activity holding owner does not match activity owner'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

revoke all on function public.validate_investment_activity() from public, anon, authenticated;

drop trigger if exists investment_activities_validate on public.investment_activities;
create trigger investment_activities_validate
  before insert on public.investment_activities
  for each row
  execute function public.validate_investment_activity();

-- Never hard-deleted, exactly like ledger_transactions/ledger_entries.
-- Unlike ledger_entries (a pure immutable child row), this table is a
-- "header" that legitimately needs one further UPDATE after insert — the
-- reversal linkage (status/reversed_by, section 11h) mirrors exactly how
-- reverse_transaction() updates ledger_transactions.status/reversed_by
-- (which likewise has no blanket prevent-update trigger). Field-level
-- immutability is instead achieved the same way ledger_transactions
-- achieves it: no UPDATE grant to authenticated at all, so only the
-- SECURITY DEFINER functions in section 11 (running as owner) can ever
-- write here.
create or replace function public.prevent_investment_activity_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'investment activities are immutable and cannot be deleted'
    using errcode = 'insufficient_privilege';
end;
$$;

revoke all on function public.prevent_investment_activity_delete() from public, anon, authenticated;

drop trigger if exists investment_activities_prevent_delete on public.investment_activities;
create trigger investment_activities_prevent_delete
  before delete on public.investment_activities
  for each row
  execute function public.prevent_investment_activity_delete();

-- =======================================================================
-- 6. public.investment_valuations
-- =======================================================================
-- Dated, user-entered, append-only. The "latest" valuation for a holding
-- (by valued_at) drives its current estimated value — a correction is
-- simply a new, later-dated valuation; nothing here is ever overwritten,
-- so the full history stays visible and auditable.

create table if not exists public.investment_valuations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  holding_id uuid not null references public.investment_holdings (id) on delete cascade,
  valued_at timestamptz not null,
  unit_value numeric(20, 6) null,
  total_value numeric(20, 4) not null,
  currency text not null default 'INR',
  source text not null default 'manual',
  note text null,
  created_at timestamptz not null default now(),

  constraint investment_valuations_source_valid check (source = 'manual'),
  constraint investment_valuations_currency_format check (currency ~ '^[A-Z]{3}$'),
  constraint investment_valuations_total_value_nonnegative check (total_value >= 0),
  constraint investment_valuations_unit_value_positive check (unit_value is null or unit_value > 0),
  constraint investment_valuations_note_length check (note is null or char_length(note) <= 1000)
);

comment on table public.investment_valuations is
  'Dated, user-entered valuations — source is fixed to ''manual'' (never '
  '''live''/''market''); the UI must always label these as manual '
  'valuations, never as real-time prices. Insert-only: history is never '
  'overwritten, and the most recent row by valued_at drives current '
  'estimated value.';

create index if not exists investment_valuations_holding_valued_at_idx
  on public.investment_valuations (holding_id, valued_at desc);

create or replace function public.validate_investment_valuation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_holding_user_id uuid;
begin
  select user_id into v_holding_user_id
    from public.investment_holdings
    where id = new.holding_id;

  if v_holding_user_id is null then
    raise exception 'investment valuation references a non-existent holding'
      using errcode = 'foreign_key_violation';
  end if;
  if v_holding_user_id <> new.user_id then
    raise exception 'investment valuation holding owner does not match valuation owner'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

revoke all on function public.validate_investment_valuation() from public, anon, authenticated;

drop trigger if exists investment_valuations_validate on public.investment_valuations;
create trigger investment_valuations_validate
  before insert on public.investment_valuations
  for each row
  execute function public.validate_investment_valuation();

create or replace function public.prevent_investment_valuation_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'investment valuations are immutable and cannot be %', lower(TG_OP)
    using errcode = 'insufficient_privilege';
end;
$$;

revoke all on function public.prevent_investment_valuation_mutation() from public, anon, authenticated;

drop trigger if exists investment_valuations_prevent_update on public.investment_valuations;
create trigger investment_valuations_prevent_update
  before update on public.investment_valuations
  for each row
  execute function public.prevent_investment_valuation_mutation();

drop trigger if exists investment_valuations_prevent_delete on public.investment_valuations;
create trigger investment_valuations_prevent_delete
  before delete on public.investment_valuations
  for each row
  execute function public.prevent_investment_valuation_mutation();

-- =======================================================================
-- 7. public.fixed_income_details
-- =======================================================================
-- One row per PPF/FD/RD holding — kind-specific fields the generic
-- investment_holdings row has no place for. A single shared table (not
-- three) keeps the kind-specific schema small and centrally validated.

create table if not exists public.fixed_income_details (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  holding_id uuid not null references public.investment_holdings (id) on delete cascade,
  kind text not null,
  provider text null,
  principal_amount numeric(20, 4) null,
  interest_rate numeric(7, 4) null,
  start_date date not null,
  maturity_date date null,
  compounding_frequency text null,
  interest_payout_mode text null,
  expected_maturity_amount numeric(20, 4) null,
  actual_maturity_amount numeric(20, 4) null,
  installment_amount numeric(20, 4) null,
  planned_installments integer null,
  recurring_item_id uuid null references public.recurring_items (id) on delete set null,
  status text not null default 'active',
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint fixed_income_details_holding_unique unique (holding_id),
  constraint fixed_income_details_kind_valid check (
    kind in ('ppf', 'fixed_deposit', 'recurring_deposit')
  ),
  constraint fixed_income_details_status_valid check (
    status in ('active', 'matured', 'closed', 'archived')
  ),
  constraint fixed_income_details_provider_length check (provider is null or char_length(provider) <= 160),
  constraint fixed_income_details_compounding_valid check (
    compounding_frequency is null
    or compounding_frequency in ('monthly', 'quarterly', 'half_yearly', 'yearly', 'at_maturity')
  ),
  constraint fixed_income_details_payout_mode_valid check (
    interest_payout_mode is null or interest_payout_mode in ('reinvest', 'payout')
  ),
  constraint fixed_income_details_principal_positive check (principal_amount is null or principal_amount > 0),
  constraint fixed_income_details_interest_rate_range check (
    interest_rate is null or interest_rate between 0 and 100
  ),
  constraint fixed_income_details_installment_positive check (
    installment_amount is null or installment_amount > 0
  ),
  constraint fixed_income_details_planned_installments_positive check (
    planned_installments is null or planned_installments > 0
  ),
  constraint fixed_income_details_maturity_after_start check (
    maturity_date is null or maturity_date >= start_date
  ),
  constraint fixed_income_details_notes_length check (notes is null or char_length(notes) <= 2000)
);

comment on table public.fixed_income_details is
  'Kind-specific fields for a PPF/FD/RD holding. interest_rate and every '
  'expected_maturity_amount are user-entered reference figures only — this '
  'app never hard-codes a government PPF rate or bank formula as business '
  'truth. recurring_item_id optionally links an RD to its Phase 6 '
  'recurring_items row (see section 8).';

drop trigger if exists set_fixed_income_details_updated_at on public.fixed_income_details;
create trigger set_fixed_income_details_updated_at
  before update on public.fixed_income_details
  for each row
  execute function public.set_updated_at();

create or replace function public.validate_fixed_income_details()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_holding_user_id uuid;
  v_recurring_user_id uuid;
begin
  select user_id into v_holding_user_id
    from public.investment_holdings
    where id = new.holding_id;

  if v_holding_user_id is null then
    raise exception 'fixed income details reference a non-existent holding'
      using errcode = 'foreign_key_violation';
  end if;
  if v_holding_user_id <> new.user_id then
    raise exception 'fixed income details holding owner does not match owner'
      using errcode = 'insufficient_privilege';
  end if;

  if new.recurring_item_id is not null then
    select user_id into v_recurring_user_id
      from public.recurring_items
      where id = new.recurring_item_id;

    if v_recurring_user_id is null then
      raise exception 'fixed income details reference a non-existent recurring item'
        using errcode = 'foreign_key_violation';
    end if;
    if v_recurring_user_id <> new.user_id then
      raise exception 'fixed income details recurring item owner does not match owner'
        using errcode = 'insufficient_privilege';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.validate_fixed_income_details() from public, anon, authenticated;

drop trigger if exists fixed_income_details_validate on public.fixed_income_details;
create trigger fixed_income_details_validate
  before insert or update on public.fixed_income_details
  for each row
  execute function public.validate_fixed_income_details();

-- =======================================================================
-- 8. Phase 6 recurring-item integration for recurring deposits
-- =======================================================================
-- One new nullable column. Every existing recurring item (budgets,
-- subscriptions, bills, plain recurring income/transfers) is completely
-- unaffected — this is only ever set by create_recurring_deposit (section
-- 13c) for an RD's own recurring_items row.

alter table public.recurring_items
  add column if not exists investment_holding_id uuid null references public.investment_holdings (id) on delete set null;

create or replace function public.validate_recurring_item_investment_link()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_holding_user_id uuid;
begin
  if new.investment_holding_id is not null then
    select user_id into v_holding_user_id
      from public.investment_holdings
      where id = new.investment_holding_id;

    if v_holding_user_id is null then
      raise exception 'recurring item references a non-existent investment holding'
        using errcode = 'foreign_key_violation';
    end if;
    if v_holding_user_id <> new.user_id then
      raise exception 'recurring item investment holding owner does not match owner'
        using errcode = 'insufficient_privilege';
    end if;
    if new.kind <> 'transfer' then
      raise exception 'only a transfer-kind recurring item can link to an investment holding'
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.validate_recurring_item_investment_link() from public, anon, authenticated;

drop trigger if exists recurring_items_validate_investment_link on public.recurring_items;
create trigger recurring_items_validate_investment_link
  before insert or update on public.recurring_items
  for each row
  execute function public.validate_recurring_item_investment_link();

-- Widen the Phase 6 auto-post processor (create or replace, identical
-- signature) to also record a matching investment_activities row — in the
-- same function call/transaction, so a failure anywhere still leaves no
-- partial state — whenever the occurrence's recurring item is an RD
-- installment. Every other recurring item (investment_holding_id null)
-- follows the exact original Phase 6 code path, byte-for-byte unchanged.
create or replace function public.attempt_post_occurrence(p_occurrence_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_occ public.recurring_occurrences;
  v_item public.recurring_items;
  v_txn_type text;
  v_entries jsonb;
  v_transaction public.ledger_transactions;
  v_idempotency_key text;
  v_source_account_type text;
  v_system_account_id uuid;
begin
  select * into v_occ from public.recurring_occurrences where id = p_occurrence_id;
  select * into v_item from public.recurring_items where id = v_occ.recurring_item_id;

  begin
    v_idempotency_key := 'recurring_occurrence:' || v_occ.id::text;

    if v_item.kind = 'transfer' then
      v_txn_type := 'transfer';
      v_entries := jsonb_build_array(
        jsonb_build_object(
          'account_id', v_item.destination_account_id,
          'amount', v_occ.amount::text, 'currency', v_occ.currency
        ),
        jsonb_build_object(
          'account_id', v_item.source_account_id,
          'amount', (-v_occ.amount)::text, 'currency', v_occ.currency
        )
      );
    elsif v_item.kind = 'income' then
      v_txn_type := 'income';
      select id into v_system_account_id from public.accounts
        where user_id = v_occ.user_id and system_code = 'uncategorized_income' and is_system = true;
      v_entries := jsonb_build_array(
        jsonb_build_object(
          'account_id', v_item.destination_account_id,
          'amount', v_occ.amount::text, 'currency', v_occ.currency
        ),
        jsonb_build_object(
          'account_id', v_system_account_id,
          'amount', (-v_occ.amount)::text, 'currency', v_occ.currency
        )
      );
    else
      select account_type into v_source_account_type
        from public.accounts where id = v_item.source_account_id;
      select id into v_system_account_id from public.accounts
        where user_id = v_occ.user_id and system_code = 'uncategorized_expense' and is_system = true;

      v_txn_type := case
        when v_source_account_type = 'credit_card' then 'credit_card_purchase'
        else 'expense'
      end;

      v_entries := jsonb_build_array(
        jsonb_build_object(
          'account_id', v_system_account_id,
          'amount', v_occ.amount::text, 'currency', v_occ.currency
        ),
        jsonb_build_object(
          'account_id', v_item.source_account_id,
          'amount', (-v_occ.amount)::text, 'currency', v_occ.currency
        )
      );
    end if;

    v_transaction := public.post_manual_transaction_for_user(
      v_occ.user_id, v_txn_type,
      (v_occ.scheduled_date::text || ' 00:00:00+05:30')::timestamptz,
      v_item.name, v_entries, null, v_item.category_id, v_item.payee_id, v_idempotency_key
    );

    if v_item.investment_holding_id is not null then
      insert into public.investment_activities (
        user_id, holding_id, activity_kind, trade_date, gross_amount, currency,
        ledger_transaction_id, idempotency_key, notes
      )
      values (
        v_occ.user_id, v_item.investment_holding_id, 'contribution', v_occ.scheduled_date,
        v_occ.amount, v_occ.currency, v_transaction.id, v_idempotency_key,
        'Recurring deposit installment: ' || v_item.name
      )
      on conflict (user_id, idempotency_key) where idempotency_key is not null do nothing;
    end if;

    update public.recurring_occurrences
      set status = 'posted', linked_transaction_id = v_transaction.id,
          processed_at = now(), updated_at = now(), failure_reason = null
      where id = v_occ.id;

    return true;
  exception when others then
    update public.recurring_occurrences
      set status = 'failed', failure_reason = left(sqlerrm, 300), updated_at = now()
      where id = v_occ.id;
    return false;
  end;
end;
$$;

-- Same widening for the user-initiated manual "record payment" path
-- (reminder-only RD installments a user records themselves).
create or replace function public.post_occurrence_payment(
  p_occurrence_id uuid,
  p_transaction_type text,
  p_occurred_at timestamptz,
  p_description text,
  p_entries jsonb,
  p_notes text default null,
  p_category_id uuid default null,
  p_payee_id uuid default null
)
returns public.ledger_transactions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_occ public.recurring_occurrences;
  v_item public.recurring_items;
  v_transaction public.ledger_transactions;
  v_idempotency_key text;
begin
  if v_user_id is null then
    raise exception 'post_occurrence_payment requires an authenticated user'
      using errcode = 'insufficient_privilege';
  end if;

  select * into v_occ from public.recurring_occurrences where id = p_occurrence_id;
  if v_occ.id is null or v_occ.user_id <> v_user_id then
    raise exception 'occurrence not found' using errcode = 'no_data_found';
  end if;

  select * into v_item from public.recurring_items where id = v_occ.recurring_item_id;
  if v_item.processing_mode <> 'reminder_only' then
    raise exception 'only a reminder-only occurrence can be paid manually'
      using errcode = 'invalid_transaction_state';
  end if;
  if v_occ.status not in ('upcoming', 'due', 'overdue') then
    raise exception 'occurrence % is not awaiting payment', p_occurrence_id
      using errcode = 'invalid_transaction_state';
  end if;

  v_idempotency_key := 'recurring_occurrence:' || v_occ.id::text;

  v_transaction := public.create_manual_transaction(
    p_transaction_type, p_occurred_at, p_description, p_entries,
    p_notes, p_category_id, p_payee_id, v_idempotency_key
  );

  if v_item.investment_holding_id is not null then
    insert into public.investment_activities (
      user_id, holding_id, activity_kind, trade_date, gross_amount, currency,
      ledger_transaction_id, idempotency_key, notes
    )
    values (
      v_user_id, v_item.investment_holding_id, 'contribution', v_occ.scheduled_date,
      v_occ.amount, v_occ.currency, v_transaction.id, v_idempotency_key,
      'Recurring deposit installment: ' || v_item.name
    )
    on conflict (user_id, idempotency_key) where idempotency_key is not null do nothing;
  end if;

  update public.recurring_occurrences
    set status = 'posted', linked_transaction_id = v_transaction.id,
        processed_at = now(), updated_at = now()
    where id = v_occ.id;

  return v_transaction;
end;
$$;

revoke all on function public.post_occurrence_payment(uuid, text, timestamptz, text, jsonb, text, uuid, uuid)
  from public, anon;
grant execute on function public.post_occurrence_payment(uuid, text, timestamptz, text, jsonb, text, uuid, uuid)
  to authenticated;

create index if not exists recurring_items_investment_holding_id_idx
  on public.recurring_items (investment_holding_id)
  where investment_holding_id is not null;

-- =======================================================================
-- 9. Position helper: public.investment_holding_position
-- =======================================================================
-- Replays a holding's immutable activity history (posted only, in
-- trade_date/created_at order) into its current quantity and remaining
-- cost basis, using the weighted-average method throughout. This is the
-- ONLY place quantity/cost-basis math happens — every summary/view/
-- function below calls this rather than re-deriving it, so there is
-- exactly one definition of "current position" in the schema.
--
-- security invoker: runs as the calling role, so RLS on
-- investment_activities restricts an authenticated caller to their own
-- rows automatically. Every caller in this file has already verified
-- holding ownership before invoking this, so "zero rows visible" here
-- never silently means "cross-user holding" — it always means "this
-- holding" (already known-owned) "has no posted activity yet".
create or replace function public.investment_holding_position(p_holding_id uuid)
returns table (quantity numeric(20, 6), cost_basis numeric(20, 4))
language plpgsql
security invoker
set search_path = ''
stable
as $$
declare
  v_activity record;
  v_quantity numeric(20, 6) := 0;
  v_cost_basis numeric(20, 4) := 0;
begin
  -- Columns are qualified with the "ia" alias below because this function
  -- has RETURNS TABLE(quantity, cost_basis) OUT parameters, which plpgsql
  -- implicitly turns into variables of the same name in scope — an
  -- unqualified "quantity" here would otherwise be ambiguous between the
  -- OUT parameter and the investment_activities.quantity column.
  -- Deliberately NOT filtered to status = 'posted': exactly like
  -- public.account_balances summing every ledger_entries row regardless
  -- of its transaction's status, a reversed activity's original row keeps
  -- contributing its full original effect here, and its reversal row
  -- (section 11h) contributes the exact negation — the pair nets to zero
  -- by construction, the same pattern the ledger itself already uses,
  -- rather than a status filter that would have to be paired with
  -- perfectly-inverted-sign bookkeeping on the reversal row alone.
  for v_activity in
    select ia.activity_kind, ia.quantity, ia.gross_amount, ia.fee_amount, ia.cost_basis_amount
    from public.investment_activities ia
    where ia.holding_id = p_holding_id
    order by ia.trade_date, ia.created_at
  loop
    if v_activity.activity_kind = 'buy' then
      v_quantity := v_quantity + coalesce(v_activity.quantity, 0);
      v_cost_basis := v_cost_basis + v_activity.gross_amount + v_activity.fee_amount;
    elsif v_activity.activity_kind = 'sell' then
      v_quantity := v_quantity - coalesce(v_activity.quantity, 0);
      v_cost_basis := v_cost_basis - coalesce(v_activity.cost_basis_amount, 0);
    elsif v_activity.activity_kind = 'contribution' then
      v_cost_basis := v_cost_basis + v_activity.gross_amount;
    elsif v_activity.activity_kind = 'withdrawal' then
      v_cost_basis := v_cost_basis - v_activity.gross_amount;
    elsif v_activity.activity_kind = 'maturity' then
      v_cost_basis := v_cost_basis - coalesce(v_activity.cost_basis_amount, 0);
    elsif v_activity.activity_kind = 'adjustment' then
      v_quantity := v_quantity + coalesce(v_activity.quantity, 0);
      v_cost_basis := v_cost_basis + coalesce(v_activity.cost_basis_amount, 0);
    end if;
    -- dividend / interest / fee: pure income or expense, no effect on
    -- this holding's quantity or cost basis (the one documented rule).
  end loop;

  return query select v_quantity, v_cost_basis;
end;
$$;

revoke all on function public.investment_holding_position(uuid) from public, anon;
grant execute on function public.investment_holding_position(uuid) to authenticated;

comment on function public.investment_holding_position is
  'Replays investment_activities into current (quantity, cost_basis) for '
  'one holding, weighted-average throughout. The single source of truth '
  'for position — never a stored, independently mutable running total.';

-- =======================================================================
-- 10. Asset and holding lifecycle
-- =======================================================================

create or replace function public.create_investment_asset(
  p_asset_kind text,
  p_display_name text,
  p_currency text default 'INR',
  p_symbol text default null,
  p_exchange text default null,
  p_isin text default null,
  p_scheme_code text default null,
  p_unit_precision integer default 4,
  p_notes text default null
)
returns public.investment_assets
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_asset public.investment_assets;
begin
  if v_user_id is null then
    raise exception 'create_investment_asset requires an authenticated user'
      using errcode = 'insufficient_privilege';
  end if;

  if p_asset_kind not in ('stock', 'mutual_fund', 'ppf', 'fixed_deposit', 'recurring_deposit', 'other_investment') then
    raise exception 'unsupported asset_kind: %', p_asset_kind
      using errcode = 'invalid_parameter_value';
  end if;

  insert into public.investment_assets (
    user_id, asset_kind, display_name, currency, symbol, exchange, isin,
    scheme_code, unit_precision, notes
  )
  values (
    v_user_id, p_asset_kind, p_display_name, p_currency, p_symbol, p_exchange,
    p_isin, p_scheme_code, p_unit_precision, p_notes
  )
  returning * into v_asset;

  return v_asset;
end;
$$;

revoke all on function public.create_investment_asset(text, text, text, text, text, text, text, integer, text)
  from public, anon;
grant execute on function public.create_investment_asset(text, text, text, text, text, text, text, integer, text)
  to authenticated;

create or replace function public.update_investment_asset(
  p_id uuid,
  p_display_name text,
  p_symbol text default null,
  p_exchange text default null,
  p_isin text default null,
  p_scheme_code text default null,
  p_notes text default null
)
returns public.investment_assets
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_asset public.investment_assets;
begin
  if v_user_id is null then
    raise exception 'update_investment_asset requires an authenticated user'
      using errcode = 'insufficient_privilege';
  end if;

  update public.investment_assets
    set display_name = p_display_name, symbol = p_symbol, exchange = p_exchange,
        isin = p_isin, scheme_code = p_scheme_code, notes = p_notes
    where id = p_id and user_id = v_user_id
    returning * into v_asset;

  if v_asset.id is null then
    raise exception 'investment asset not found' using errcode = 'no_data_found';
  end if;

  return v_asset;
end;
$$;

revoke all on function public.update_investment_asset(uuid, text, text, text, text, text, text) from public, anon;
grant execute on function public.update_investment_asset(uuid, text, text, text, text, text, text) to authenticated;

comment on function public.update_investment_asset is
  'Updates only descriptive metadata — asset_kind and currency are fixed '
  'at creation, exactly like an account''s class/type (rule reused from '
  'Phase 3).';

create or replace function public.set_investment_asset_status(p_id uuid, p_status text)
returns public.investment_assets
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_asset public.investment_assets;
begin
  if v_user_id is null then
    raise exception 'set_investment_asset_status requires an authenticated user'
      using errcode = 'insufficient_privilege';
  end if;
  if p_status not in ('active', 'archived') then
    raise exception 'unsupported investment asset status: %', p_status
      using errcode = 'invalid_parameter_value';
  end if;

  update public.investment_assets
    set status = p_status
    where id = p_id and user_id = v_user_id
    returning * into v_asset;

  if v_asset.id is null then
    raise exception 'investment asset not found' using errcode = 'no_data_found';
  end if;

  return v_asset;
end;
$$;

revoke all on function public.set_investment_asset_status(uuid, text) from public, anon;
grant execute on function public.set_investment_asset_status(uuid, text) to authenticated;

-- Creates a holding for an existing asset. investment_account_id, when
-- given, must already be one of the caller's own 'investment'-type
-- accounts (validated by the trigger in section 4) — this function does
-- not create the account itself; the user creates it once via the
-- existing /app/accounts/new flow (section 1) and links it here and to
-- as many holdings as they like.
create or replace function public.create_investment_holding(
  p_investment_asset_id uuid,
  p_investment_account_id uuid default null,
  p_opened_date date default null,
  p_currency text default 'INR'
)
returns public.investment_holdings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_asset_owner uuid;
  v_holding public.investment_holdings;
begin
  if v_user_id is null then
    raise exception 'create_investment_holding requires an authenticated user'
      using errcode = 'insufficient_privilege';
  end if;

  select user_id into v_asset_owner from public.investment_assets where id = p_investment_asset_id;
  if v_asset_owner is null or v_asset_owner <> v_user_id then
    raise exception 'investment asset not found' using errcode = 'no_data_found';
  end if;

  insert into public.investment_holdings (
    user_id, investment_asset_id, investment_account_id, currency, opened_date
  )
  values (
    v_user_id, p_investment_asset_id, p_investment_account_id, p_currency,
    coalesce(p_opened_date, (now() at time zone 'Asia/Kolkata')::date)
  )
  returning * into v_holding;

  return v_holding;
end;
$$;

revoke all on function public.create_investment_holding(uuid, uuid, date, text) from public, anon;
grant execute on function public.create_investment_holding(uuid, uuid, date, text) to authenticated;

create or replace function public.set_investment_holding_status(p_id uuid, p_status text)
returns public.investment_holdings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_holding public.investment_holdings;
begin
  if v_user_id is null then
    raise exception 'set_investment_holding_status requires an authenticated user'
      using errcode = 'insufficient_privilege';
  end if;
  if p_status not in ('active', 'archived') then
    raise exception 'unsupported investment holding status: %', p_status
      using errcode = 'invalid_parameter_value';
  end if;

  update public.investment_holdings
    set status = p_status
    where id = p_id and user_id = v_user_id
    returning * into v_holding;

  if v_holding.id is null then
    raise exception 'investment holding not found' using errcode = 'no_data_found';
  end if;

  return v_holding;
end;
$$;

revoke all on function public.set_investment_holding_status(uuid, text) from public, anon;
grant execute on function public.set_investment_holding_status(uuid, text) to authenticated;

-- =======================================================================
-- 11. Recording investment activities
-- =======================================================================
-- Every function below follows the same shape: validate ownership and
-- state, compute exact decimals in SQL, post one balanced transaction
-- through the shared core (section 2), then insert the matching
-- investment_activities row — all in one plpgsql function body, so a
-- failure at any point rolls back everything (no partial activity, no
-- orphaned transaction). p_idempotency_key is always a client-generated
-- UUID (exactly like every manual transaction form, src/lib/ledger/
-- schema.ts's idempotencyKeySchema) — a retried submission with the same
-- key returns the original activity untouched, never a duplicate.

-- 11a. Purchase: gross_amount is always computed server-side as
-- quantity * unit_price — never trusted as a separate client value, so
-- the two can never silently disagree. Fees are added to cost basis (the
-- one documented fee rule, see the file header).
create or replace function public.record_investment_purchase(
  p_holding_id uuid,
  p_funding_account_id uuid,
  p_trade_date date,
  p_quantity numeric,
  p_unit_price numeric,
  p_idempotency_key uuid,
  p_fee_amount numeric default 0,
  p_settlement_date date default null,
  p_notes text default null
)
returns public.investment_activities
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_holding public.investment_holdings;
  v_funding_owner uuid;
  v_gross_amount numeric(20, 4);
  v_transaction public.ledger_transactions;
  v_activity public.investment_activities;
begin
  if v_user_id is null then
    raise exception 'record_investment_purchase requires an authenticated user'
      using errcode = 'insufficient_privilege';
  end if;
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'quantity must be greater than zero' using errcode = 'invalid_parameter_value';
  end if;
  if p_unit_price is null or p_unit_price <= 0 then
    raise exception 'unit price must be greater than zero' using errcode = 'invalid_parameter_value';
  end if;
  if p_fee_amount is null or p_fee_amount < 0 then
    raise exception 'fee amount cannot be negative' using errcode = 'invalid_parameter_value';
  end if;

  select * into v_holding from public.investment_holdings
    where id = p_holding_id and user_id = v_user_id;
  if v_holding.id is null then
    raise exception 'investment holding not found' using errcode = 'no_data_found';
  end if;
  if v_holding.status <> 'active' then
    raise exception 'cannot record an activity against an archived holding'
      using errcode = 'invalid_transaction_state';
  end if;
  if v_holding.investment_account_id is null then
    raise exception 'this holding has no linked investment account'
      using errcode = 'invalid_transaction_state';
  end if;

  select user_id into v_funding_owner from public.accounts where id = p_funding_account_id;
  if v_funding_owner is null or v_funding_owner <> v_user_id then
    raise exception 'funding account not found' using errcode = 'no_data_found';
  end if;

  select * into v_activity from public.investment_activities
    where user_id = v_user_id and idempotency_key = p_idempotency_key::text;
  if v_activity.id is not null then
    return v_activity;
  end if;

  v_gross_amount := round(p_quantity * p_unit_price, 4);

  v_transaction := public.post_manual_transaction_for_user(
    v_user_id, 'investment_buy', (p_trade_date::text || ' 00:00:00+05:30')::timestamptz,
    'Investment purchase',
    jsonb_build_array(
      jsonb_build_object(
        'account_id', v_holding.investment_account_id,
        'amount', (v_gross_amount + p_fee_amount)::text, 'currency', v_holding.currency
      ),
      jsonb_build_object(
        'account_id', p_funding_account_id,
        'amount', (-(v_gross_amount + p_fee_amount))::text, 'currency', v_holding.currency
      )
    ),
    p_notes, null, null, p_idempotency_key::text
  );

  insert into public.investment_activities (
    user_id, holding_id, activity_kind, trade_date, settlement_date,
    quantity, unit_price, gross_amount, fee_amount, currency,
    ledger_transaction_id, idempotency_key, notes
  )
  values (
    v_user_id, p_holding_id, 'buy', p_trade_date, p_settlement_date,
    p_quantity, p_unit_price, v_gross_amount, p_fee_amount, v_holding.currency,
    v_transaction.id, p_idempotency_key::text, p_notes
  )
  returning * into v_activity;

  return v_activity;
end;
$$;

revoke all on function public.record_investment_purchase(uuid, uuid, date, numeric, numeric, uuid, numeric, date, text)
  from public, anon;
grant execute on function public.record_investment_purchase(uuid, uuid, date, numeric, numeric, uuid, numeric, date, text)
  to authenticated;

-- 11b. Sale: cost basis consumed is computed from the weighted-average
-- position at the moment of sale (section 9) and stored immutably on the
-- activity row, so a later purchase can never retroactively change a past
-- sale's recorded realized gain/loss. A sale for more units than currently
-- held is rejected outright.
create or replace function public.record_investment_sale(
  p_holding_id uuid,
  p_receiving_account_id uuid,
  p_trade_date date,
  p_quantity numeric,
  p_unit_price numeric,
  p_idempotency_key uuid,
  p_fee_amount numeric default 0,
  p_tax_amount numeric default 0,
  p_settlement_date date default null,
  p_notes text default null
)
returns public.investment_activities
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_holding public.investment_holdings;
  v_receiving_owner uuid;
  v_position record;
  v_gross_proceeds numeric(20, 4);
  v_net_proceeds numeric(20, 4);
  v_cost_basis_consumed numeric(20, 4);
  v_realized_gain numeric(20, 4);
  v_gains_account_id uuid;
  v_entries jsonb;
  v_transaction public.ledger_transactions;
  v_activity public.investment_activities;
begin
  if v_user_id is null then
    raise exception 'record_investment_sale requires an authenticated user'
      using errcode = 'insufficient_privilege';
  end if;
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'quantity must be greater than zero' using errcode = 'invalid_parameter_value';
  end if;
  if p_unit_price is null or p_unit_price <= 0 then
    raise exception 'unit price must be greater than zero' using errcode = 'invalid_parameter_value';
  end if;
  if p_fee_amount is null or p_fee_amount < 0 or p_tax_amount is null or p_tax_amount < 0 then
    raise exception 'fee and tax amounts cannot be negative' using errcode = 'invalid_parameter_value';
  end if;

  select * into v_holding from public.investment_holdings
    where id = p_holding_id and user_id = v_user_id;
  if v_holding.id is null then
    raise exception 'investment holding not found' using errcode = 'no_data_found';
  end if;
  if v_holding.status <> 'active' then
    raise exception 'cannot record an activity against an archived holding'
      using errcode = 'invalid_transaction_state';
  end if;
  if v_holding.investment_account_id is null then
    raise exception 'this holding has no linked investment account'
      using errcode = 'invalid_transaction_state';
  end if;

  select user_id into v_receiving_owner from public.accounts where id = p_receiving_account_id;
  if v_receiving_owner is null or v_receiving_owner <> v_user_id then
    raise exception 'receiving account not found' using errcode = 'no_data_found';
  end if;

  select * into v_activity from public.investment_activities
    where user_id = v_user_id and idempotency_key = p_idempotency_key::text;
  if v_activity.id is not null then
    return v_activity;
  end if;

  select * into v_position from public.investment_holding_position(p_holding_id);
  if p_quantity > v_position.quantity then
    raise exception 'cannot sell % units — only % are held', p_quantity, v_position.quantity
      using errcode = 'check_violation';
  end if;

  v_cost_basis_consumed := case
    when v_position.quantity = 0 then 0
    else round(v_position.cost_basis * p_quantity / v_position.quantity, 4)
  end;
  v_gross_proceeds := round(p_quantity * p_unit_price, 4);
  v_net_proceeds := v_gross_proceeds - p_fee_amount - p_tax_amount;
  v_realized_gain := v_net_proceeds - v_cost_basis_consumed;

  select id into v_gains_account_id from public.accounts
    where user_id = v_user_id and system_code = 'realized_investment_gains' and is_system = true;

  v_entries := jsonb_build_array(
    jsonb_build_object(
      'account_id', p_receiving_account_id,
      'amount', v_net_proceeds::text, 'currency', v_holding.currency
    ),
    jsonb_build_object(
      'account_id', v_holding.investment_account_id,
      'amount', (-v_cost_basis_consumed)::text, 'currency', v_holding.currency
    )
  );
  if v_realized_gain <> 0 then
    v_entries := v_entries || jsonb_build_array(
      jsonb_build_object(
        'account_id', v_gains_account_id,
        'amount', (-v_realized_gain)::text, 'currency', v_holding.currency
      )
    );
  end if;

  v_transaction := public.post_manual_transaction_for_user(
    v_user_id, 'investment_sell', (p_trade_date::text || ' 00:00:00+05:30')::timestamptz,
    'Investment sale', v_entries, p_notes, null, null, p_idempotency_key::text
  );

  insert into public.investment_activities (
    user_id, holding_id, activity_kind, trade_date, settlement_date,
    quantity, unit_price, gross_amount, fee_amount, tax_amount,
    cost_basis_amount, realized_gain_amount, currency,
    ledger_transaction_id, idempotency_key, notes
  )
  values (
    v_user_id, p_holding_id, 'sell', p_trade_date, p_settlement_date,
    p_quantity, p_unit_price, v_gross_proceeds, p_fee_amount, p_tax_amount,
    v_cost_basis_consumed, v_realized_gain, v_holding.currency,
    v_transaction.id, p_idempotency_key::text, p_notes
  )
  returning * into v_activity;

  return v_activity;
end;
$$;

revoke all on function public.record_investment_sale(
  uuid, uuid, date, numeric, numeric, uuid, numeric, numeric, date, text
) from public, anon;
grant execute on function public.record_investment_sale(
  uuid, uuid, date, numeric, numeric, uuid, numeric, numeric, date, text
) to authenticated;

-- 11c. Contribution: a pure cash movement into the holding — PPF/FD/RD
-- funding, or "buying" more of a no-unit-price asset. No quantity/price.
create or replace function public.record_investment_contribution(
  p_holding_id uuid,
  p_funding_account_id uuid,
  p_trade_date date,
  p_gross_amount numeric,
  p_idempotency_key uuid,
  p_notes text default null
)
returns public.investment_activities
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_holding public.investment_holdings;
  v_funding_owner uuid;
  v_transaction public.ledger_transactions;
  v_activity public.investment_activities;
begin
  if v_user_id is null then
    raise exception 'record_investment_contribution requires an authenticated user'
      using errcode = 'insufficient_privilege';
  end if;
  if p_gross_amount is null or p_gross_amount <= 0 then
    raise exception 'amount must be greater than zero' using errcode = 'invalid_parameter_value';
  end if;

  select * into v_holding from public.investment_holdings
    where id = p_holding_id and user_id = v_user_id;
  if v_holding.id is null then
    raise exception 'investment holding not found' using errcode = 'no_data_found';
  end if;
  if v_holding.status <> 'active' then
    raise exception 'cannot record an activity against an archived holding'
      using errcode = 'invalid_transaction_state';
  end if;
  if v_holding.investment_account_id is null then
    raise exception 'this holding has no linked investment account'
      using errcode = 'invalid_transaction_state';
  end if;

  select user_id into v_funding_owner from public.accounts where id = p_funding_account_id;
  if v_funding_owner is null or v_funding_owner <> v_user_id then
    raise exception 'funding account not found' using errcode = 'no_data_found';
  end if;

  select * into v_activity from public.investment_activities
    where user_id = v_user_id and idempotency_key = p_idempotency_key::text;
  if v_activity.id is not null then
    return v_activity;
  end if;

  v_transaction := public.post_manual_transaction_for_user(
    v_user_id, 'investment_contribution', (p_trade_date::text || ' 00:00:00+05:30')::timestamptz,
    'Investment contribution',
    jsonb_build_array(
      jsonb_build_object(
        'account_id', v_holding.investment_account_id,
        'amount', p_gross_amount::text, 'currency', v_holding.currency
      ),
      jsonb_build_object(
        'account_id', p_funding_account_id,
        'amount', (-p_gross_amount)::text, 'currency', v_holding.currency
      )
    ),
    p_notes, null, null, p_idempotency_key::text
  );

  insert into public.investment_activities (
    user_id, holding_id, activity_kind, trade_date, gross_amount, currency,
    ledger_transaction_id, idempotency_key, notes
  )
  values (
    v_user_id, p_holding_id, 'contribution', p_trade_date, p_gross_amount, v_holding.currency,
    v_transaction.id, p_idempotency_key::text, p_notes
  )
  returning * into v_activity;

  return v_activity;
end;
$$;

revoke all on function public.record_investment_contribution(uuid, uuid, date, numeric, uuid, text) from public, anon;
grant execute on function public.record_investment_contribution(uuid, uuid, date, numeric, uuid, text) to authenticated;

-- 11d. Withdrawal: a pure cash movement out of the holding, capped at the
-- currently-held balance (cost basis) — generalizes "cannot sell more
-- units than held" to non-unit assets. Interest is never folded in here;
-- record it separately via record_investment_income (11e).
create or replace function public.record_investment_withdrawal(
  p_holding_id uuid,
  p_receiving_account_id uuid,
  p_trade_date date,
  p_gross_amount numeric,
  p_idempotency_key uuid,
  p_notes text default null
)
returns public.investment_activities
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_holding public.investment_holdings;
  v_receiving_owner uuid;
  v_position record;
  v_transaction public.ledger_transactions;
  v_activity public.investment_activities;
begin
  if v_user_id is null then
    raise exception 'record_investment_withdrawal requires an authenticated user'
      using errcode = 'insufficient_privilege';
  end if;
  if p_gross_amount is null or p_gross_amount <= 0 then
    raise exception 'amount must be greater than zero' using errcode = 'invalid_parameter_value';
  end if;

  select * into v_holding from public.investment_holdings
    where id = p_holding_id and user_id = v_user_id;
  if v_holding.id is null then
    raise exception 'investment holding not found' using errcode = 'no_data_found';
  end if;
  if v_holding.status <> 'active' then
    raise exception 'cannot record an activity against an archived holding'
      using errcode = 'invalid_transaction_state';
  end if;
  if v_holding.investment_account_id is null then
    raise exception 'this holding has no linked investment account'
      using errcode = 'invalid_transaction_state';
  end if;

  select user_id into v_receiving_owner from public.accounts where id = p_receiving_account_id;
  if v_receiving_owner is null or v_receiving_owner <> v_user_id then
    raise exception 'receiving account not found' using errcode = 'no_data_found';
  end if;

  select * into v_activity from public.investment_activities
    where user_id = v_user_id and idempotency_key = p_idempotency_key::text;
  if v_activity.id is not null then
    return v_activity;
  end if;

  select * into v_position from public.investment_holding_position(p_holding_id);
  if p_gross_amount > v_position.cost_basis then
    raise exception 'cannot withdraw % — only % is available', p_gross_amount, v_position.cost_basis
      using errcode = 'check_violation';
  end if;

  v_transaction := public.post_manual_transaction_for_user(
    v_user_id, 'investment_withdrawal', (p_trade_date::text || ' 00:00:00+05:30')::timestamptz,
    'Investment withdrawal',
    jsonb_build_array(
      jsonb_build_object(
        'account_id', p_receiving_account_id,
        'amount', p_gross_amount::text, 'currency', v_holding.currency
      ),
      jsonb_build_object(
        'account_id', v_holding.investment_account_id,
        'amount', (-p_gross_amount)::text, 'currency', v_holding.currency
      )
    ),
    p_notes, null, null, p_idempotency_key::text
  );

  insert into public.investment_activities (
    user_id, holding_id, activity_kind, trade_date, gross_amount, currency,
    ledger_transaction_id, idempotency_key, notes
  )
  values (
    v_user_id, p_holding_id, 'withdrawal', p_trade_date, p_gross_amount, v_holding.currency,
    v_transaction.id, p_idempotency_key::text, p_notes
  )
  returning * into v_activity;

  return v_activity;
end;
$$;

revoke all on function public.record_investment_withdrawal(uuid, uuid, date, numeric, uuid, text) from public, anon;
grant execute on function public.record_investment_withdrawal(uuid, uuid, date, numeric, uuid, text) to authenticated;

-- 11e. Dividend/interest: real income, posted through the exact same
-- 'income' transaction_type + category the manual income form uses (see
-- validate_ledger_transaction_refs, Phase 5, which already requires an
-- income-type category here) — never a separate weaker income path.
create or replace function public.record_investment_income(
  p_holding_id uuid,
  p_activity_kind text,
  p_receiving_account_id uuid,
  p_trade_date date,
  p_gross_amount numeric,
  p_category_id uuid,
  p_idempotency_key uuid,
  p_payee_id uuid default null,
  p_notes text default null
)
returns public.investment_activities
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_holding public.investment_holdings;
  v_receiving_owner uuid;
  v_income_account_id uuid;
  v_transaction public.ledger_transactions;
  v_activity public.investment_activities;
begin
  if v_user_id is null then
    raise exception 'record_investment_income requires an authenticated user'
      using errcode = 'insufficient_privilege';
  end if;
  if p_activity_kind not in ('dividend', 'interest') then
    raise exception 'unsupported income activity_kind: %', p_activity_kind
      using errcode = 'invalid_parameter_value';
  end if;
  if p_gross_amount is null or p_gross_amount <= 0 then
    raise exception 'amount must be greater than zero' using errcode = 'invalid_parameter_value';
  end if;

  select * into v_holding from public.investment_holdings
    where id = p_holding_id and user_id = v_user_id;
  if v_holding.id is null then
    raise exception 'investment holding not found' using errcode = 'no_data_found';
  end if;

  select user_id into v_receiving_owner from public.accounts where id = p_receiving_account_id;
  if v_receiving_owner is null or v_receiving_owner <> v_user_id then
    raise exception 'receiving account not found' using errcode = 'no_data_found';
  end if;

  select * into v_activity from public.investment_activities
    where user_id = v_user_id and idempotency_key = p_idempotency_key::text;
  if v_activity.id is not null then
    return v_activity;
  end if;

  select id into v_income_account_id from public.accounts
    where user_id = v_user_id and system_code = 'uncategorized_income' and is_system = true;

  v_transaction := public.post_manual_transaction_for_user(
    v_user_id, 'income', (p_trade_date::text || ' 00:00:00+05:30')::timestamptz,
    initcap(p_activity_kind) || ' income',
    jsonb_build_array(
      jsonb_build_object(
        'account_id', p_receiving_account_id,
        'amount', p_gross_amount::text, 'currency', v_holding.currency
      ),
      jsonb_build_object(
        'account_id', v_income_account_id,
        'amount', (-p_gross_amount)::text, 'currency', v_holding.currency
      )
    ),
    p_notes, p_category_id, p_payee_id, p_idempotency_key::text
  );

  insert into public.investment_activities (
    user_id, holding_id, activity_kind, trade_date, gross_amount, currency,
    category_id, payee_id, ledger_transaction_id, idempotency_key, notes
  )
  values (
    v_user_id, p_holding_id, p_activity_kind, p_trade_date, p_gross_amount, v_holding.currency,
    p_category_id, p_payee_id, v_transaction.id, p_idempotency_key::text, p_notes
  )
  returning * into v_activity;

  return v_activity;
end;
$$;

revoke all on function public.record_investment_income(uuid, text, uuid, date, numeric, uuid, uuid, uuid, text)
  from public, anon;
grant execute on function public.record_investment_income(uuid, text, uuid, date, numeric, uuid, uuid, uuid, text)
  to authenticated;

-- 11f. Standalone fee (not folded into a specific buy/sell) — a real
-- expense, posted through the exact same 'expense' transaction_type +
-- category the manual expense form uses. Never affects cost basis (the
-- documented fee rule, file header).
create or replace function public.record_investment_fee(
  p_holding_id uuid,
  p_funding_account_id uuid,
  p_trade_date date,
  p_gross_amount numeric,
  p_idempotency_key uuid,
  p_category_id uuid default null,
  p_notes text default null
)
returns public.investment_activities
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_holding public.investment_holdings;
  v_funding_owner uuid;
  v_expense_account_id uuid;
  v_transaction public.ledger_transactions;
  v_activity public.investment_activities;
begin
  if v_user_id is null then
    raise exception 'record_investment_fee requires an authenticated user'
      using errcode = 'insufficient_privilege';
  end if;
  if p_gross_amount is null or p_gross_amount <= 0 then
    raise exception 'amount must be greater than zero' using errcode = 'invalid_parameter_value';
  end if;

  select * into v_holding from public.investment_holdings
    where id = p_holding_id and user_id = v_user_id;
  if v_holding.id is null then
    raise exception 'investment holding not found' using errcode = 'no_data_found';
  end if;

  select user_id into v_funding_owner from public.accounts where id = p_funding_account_id;
  if v_funding_owner is null or v_funding_owner <> v_user_id then
    raise exception 'funding account not found' using errcode = 'no_data_found';
  end if;

  select * into v_activity from public.investment_activities
    where user_id = v_user_id and idempotency_key = p_idempotency_key::text;
  if v_activity.id is not null then
    return v_activity;
  end if;

  select id into v_expense_account_id from public.accounts
    where user_id = v_user_id and system_code = 'uncategorized_expense' and is_system = true;

  v_transaction := public.post_manual_transaction_for_user(
    v_user_id, 'expense', (p_trade_date::text || ' 00:00:00+05:30')::timestamptz,
    'Investment fee',
    jsonb_build_array(
      jsonb_build_object(
        'account_id', v_expense_account_id,
        'amount', p_gross_amount::text, 'currency', v_holding.currency
      ),
      jsonb_build_object(
        'account_id', p_funding_account_id,
        'amount', (-p_gross_amount)::text, 'currency', v_holding.currency
      )
    ),
    p_notes, p_category_id, null, p_idempotency_key::text
  );

  insert into public.investment_activities (
    user_id, holding_id, activity_kind, trade_date, gross_amount, currency,
    category_id, ledger_transaction_id, idempotency_key, notes
  )
  values (
    v_user_id, p_holding_id, 'fee', p_trade_date, p_gross_amount, v_holding.currency,
    p_category_id, v_transaction.id, p_idempotency_key::text, p_notes
  )
  returning * into v_activity;

  return v_activity;
end;
$$;

revoke all on function public.record_investment_fee(uuid, uuid, date, numeric, uuid, uuid, text) from public, anon;
grant execute on function public.record_investment_fee(uuid, uuid, date, numeric, uuid, uuid, text) to authenticated;

-- 11g. Adjustment: an explicit, audited correction to quantity and/or
-- cost basis with no ledger effect — for fixing a mistaken past entry
-- that cannot itself be edited (activities are immutable). Requires
-- meaningful notes; never a silent shortcut.
create or replace function public.record_investment_adjustment(
  p_holding_id uuid,
  p_trade_date date,
  p_notes text,
  p_quantity_delta numeric default null,
  p_cost_basis_delta numeric default null
)
returns public.investment_activities
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_holding_owner uuid;
  v_activity public.investment_activities;
begin
  if v_user_id is null then
    raise exception 'record_investment_adjustment requires an authenticated user'
      using errcode = 'insufficient_privilege';
  end if;
  if p_notes is null or char_length(btrim(p_notes)) < 10 then
    raise exception 'an adjustment requires a written explanation of at least 10 characters'
      using errcode = 'invalid_parameter_value';
  end if;
  if p_quantity_delta is null and p_cost_basis_delta is null then
    raise exception 'an adjustment must change at least one of quantity or cost basis'
      using errcode = 'invalid_parameter_value';
  end if;

  select user_id into v_holding_owner from public.investment_holdings
    where id = p_holding_id and user_id = v_user_id;
  if v_holding_owner is null then
    raise exception 'investment holding not found' using errcode = 'no_data_found';
  end if;

  insert into public.investment_activities (
    user_id, holding_id, activity_kind, trade_date, quantity, gross_amount,
    cost_basis_amount, notes
  )
  values (
    v_user_id, p_holding_id, 'adjustment', p_trade_date, p_quantity_delta, 0,
    p_cost_basis_delta, p_notes
  )
  returning * into v_activity;

  return v_activity;
end;
$$;

revoke all on function public.record_investment_adjustment(uuid, date, text, numeric, numeric) from public, anon;
grant execute on function public.record_investment_adjustment(uuid, date, text, numeric, numeric) to authenticated;

-- 11h. Reversal: reuses reverse_transaction() (Phase 3) verbatim for the
-- ledger effect — never a duplicated reversal implementation — then marks
-- the activity itself reversed and links the two, exactly mirroring how
-- reverse_transaction links ledger_transactions.reversed_by. Race-safe
-- via the same conditional-UPDATE guard pattern.
create or replace function public.reverse_investment_activity(p_activity_id uuid)
returns public.investment_activities
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_original public.investment_activities;
  v_locked_id uuid;
  v_reversal_txn public.ledger_transactions;
  v_reversal public.investment_activities;
begin
  if v_user_id is null then
    raise exception 'reverse_investment_activity requires an authenticated user'
      using errcode = 'insufficient_privilege';
  end if;

  select * into v_original from public.investment_activities
    where id = p_activity_id and user_id = v_user_id;
  if v_original.id is null then
    raise exception 'investment activity not found' using errcode = 'no_data_found';
  end if;
  if v_original.ledger_transaction_id is null then
    raise exception 'this activity has no ledger effect to reverse (adjustments cannot be reversed this way)'
      using errcode = 'invalid_transaction_state';
  end if;

  update public.investment_activities
    set status = 'reversed'
    where id = p_activity_id and status = 'posted' and reversed_by is null
    returning id into v_locked_id;

  if v_locked_id is null then
    raise exception 'activity % is not eligible for reversal (already reversed)', p_activity_id
      using errcode = 'invalid_transaction_state';
  end if;

  v_reversal_txn := public.reverse_transaction(v_original.ledger_transaction_id);

  insert into public.investment_activities (
    user_id, holding_id, activity_kind, trade_date, quantity, unit_price,
    gross_amount, fee_amount, tax_amount, cost_basis_amount, realized_gain_amount,
    currency, ledger_transaction_id, notes, reversal_of
  )
  values (
    v_user_id, v_original.holding_id, v_original.activity_kind,
    (v_reversal_txn.occurred_at at time zone 'Asia/Kolkata')::date,
    case when v_original.quantity is null then null else -v_original.quantity end, v_original.unit_price,
    -v_original.gross_amount, -v_original.fee_amount, -v_original.tax_amount,
    case when v_original.cost_basis_amount is null then null else -v_original.cost_basis_amount end,
    case when v_original.realized_gain_amount is null then null else -v_original.realized_gain_amount end,
    v_original.currency, v_reversal_txn.id,
    'Reversal of: ' || coalesce(v_original.notes, v_original.activity_kind), v_original.id
  )
  returning * into v_reversal;

  update public.investment_activities
    set reversed_by = v_reversal.id
    where id = p_activity_id;

  return v_reversal;
end;
$$;

revoke all on function public.reverse_investment_activity(uuid) from public, anon;
grant execute on function public.reverse_investment_activity(uuid) to authenticated;

comment on function public.reverse_investment_activity is
  'Reverses an activity''s ledger effect via reverse_transaction() '
  '(never a duplicated reversal implementation) and records a linked, '
  'negated investment_activities row — the original is never deleted or '
  'edited, preserving full audit history exactly like ledger reversal.';

-- =======================================================================
-- 12. Manual valuations
-- =======================================================================
-- Insert-only (see section 6) — adding a valuation never touches an
-- earlier one. source is hard-coded to 'manual'; there is no code path
-- anywhere in this schema that can set it to anything else.

create or replace function public.add_investment_valuation(
  p_holding_id uuid,
  p_valued_at timestamptz,
  p_total_value numeric,
  p_unit_value numeric default null,
  p_note text default null
)
returns public.investment_valuations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_holding public.investment_holdings;
  v_valuation public.investment_valuations;
begin
  if v_user_id is null then
    raise exception 'add_investment_valuation requires an authenticated user'
      using errcode = 'insufficient_privilege';
  end if;
  if p_total_value is null or p_total_value < 0 then
    raise exception 'total value cannot be negative' using errcode = 'invalid_parameter_value';
  end if;

  select * into v_holding from public.investment_holdings
    where id = p_holding_id and user_id = v_user_id;
  if v_holding.id is null then
    raise exception 'investment holding not found' using errcode = 'no_data_found';
  end if;

  insert into public.investment_valuations (
    user_id, holding_id, valued_at, unit_value, total_value, currency, source, note
  )
  values (
    v_user_id, p_holding_id, p_valued_at, p_unit_value, p_total_value, v_holding.currency,
    'manual', p_note
  )
  returning * into v_valuation;

  return v_valuation;
end;
$$;

revoke all on function public.add_investment_valuation(uuid, timestamptz, numeric, numeric, text) from public, anon;
grant execute on function public.add_investment_valuation(uuid, timestamptz, numeric, numeric, text) to authenticated;

comment on function public.add_investment_valuation is
  'Inserts a new, dated manual valuation — never updates or replaces an '
  'earlier one (see section 6). The latest row by valued_at for a holding '
  'is what public.investment_holding_summary (section 14) treats as the '
  'current estimated value.';

-- =======================================================================
-- 13. Fixed-income (PPF / FD / RD) lifecycle
-- =======================================================================

-- 13a. PPF: asset + holding + fixed_income_details, with an optional
-- opening contribution posted exactly like any other contribution.
create or replace function public.create_ppf_account(
  p_display_name text,
  p_investment_account_id uuid,
  p_start_date date,
  p_provider text default null,
  p_maturity_date date default null,
  p_interest_rate numeric default null,
  p_notes text default null,
  p_opening_contribution_amount numeric default null,
  p_opening_contribution_funding_account_id uuid default null,
  p_opening_contribution_idempotency_key uuid default null
)
returns public.investment_holdings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_asset public.investment_assets;
  v_holding public.investment_holdings;
begin
  if v_user_id is null then
    raise exception 'create_ppf_account requires an authenticated user'
      using errcode = 'insufficient_privilege';
  end if;

  v_asset := public.create_investment_asset(
    p_asset_kind => 'ppf', p_display_name => p_display_name, p_unit_precision => 0
  );
  v_holding := public.create_investment_holding(
    p_investment_asset_id => v_asset.id, p_investment_account_id => p_investment_account_id,
    p_opened_date => p_start_date
  );

  insert into public.fixed_income_details (
    user_id, holding_id, kind, provider, start_date, maturity_date, interest_rate, notes
  )
  values (
    v_user_id, v_holding.id, 'ppf', p_provider, p_start_date, p_maturity_date, p_interest_rate, p_notes
  );

  if p_opening_contribution_amount is not null and p_opening_contribution_amount > 0 then
    if p_opening_contribution_funding_account_id is null or p_opening_contribution_idempotency_key is null then
      raise exception 'a funding account and idempotency key are required with an opening contribution'
        using errcode = 'invalid_parameter_value';
    end if;
    perform public.record_investment_contribution(
      p_holding_id => v_holding.id,
      p_funding_account_id => p_opening_contribution_funding_account_id,
      p_trade_date => p_start_date,
      p_gross_amount => p_opening_contribution_amount,
      p_idempotency_key => p_opening_contribution_idempotency_key,
      p_notes => 'Opening PPF contribution'
    );
  end if;

  return v_holding;
end;
$$;

revoke all on function public.create_ppf_account(
  text, uuid, date, text, date, numeric, text, numeric, uuid, uuid
) from public, anon;
grant execute on function public.create_ppf_account(
  text, uuid, date, text, date, numeric, text, numeric, uuid, uuid
) to authenticated;

-- 13b. Fixed deposit: asset + holding + fixed_income_details, with the
-- principal always posted as an asset transfer (record_investment_
-- contribution), never as an expense — per the Phase 7 spec.
create or replace function public.create_fixed_deposit(
  p_display_name text,
  p_investment_account_id uuid,
  p_funding_account_id uuid,
  p_principal_amount numeric,
  p_start_date date,
  p_maturity_date date,
  p_idempotency_key uuid,
  p_provider text default null,
  p_interest_rate numeric default null,
  p_compounding_frequency text default null,
  p_interest_payout_mode text default null,
  p_expected_maturity_amount numeric default null,
  p_notes text default null
)
returns public.investment_holdings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_asset public.investment_assets;
  v_holding public.investment_holdings;
begin
  if v_user_id is null then
    raise exception 'create_fixed_deposit requires an authenticated user'
      using errcode = 'insufficient_privilege';
  end if;
  if p_principal_amount is null or p_principal_amount <= 0 then
    raise exception 'principal amount must be greater than zero' using errcode = 'invalid_parameter_value';
  end if;
  if p_maturity_date < p_start_date then
    raise exception 'maturity date cannot be before the start date' using errcode = 'invalid_parameter_value';
  end if;

  v_asset := public.create_investment_asset(
    p_asset_kind => 'fixed_deposit', p_display_name => p_display_name, p_unit_precision => 0
  );
  v_holding := public.create_investment_holding(
    p_investment_asset_id => v_asset.id, p_investment_account_id => p_investment_account_id,
    p_opened_date => p_start_date
  );

  insert into public.fixed_income_details (
    user_id, holding_id, kind, provider, principal_amount, interest_rate, start_date,
    maturity_date, compounding_frequency, interest_payout_mode, expected_maturity_amount, notes
  )
  values (
    v_user_id, v_holding.id, 'fixed_deposit', p_provider, p_principal_amount, p_interest_rate,
    p_start_date, p_maturity_date, p_compounding_frequency, p_interest_payout_mode,
    p_expected_maturity_amount, p_notes
  );

  perform public.record_investment_contribution(
    p_holding_id => v_holding.id,
    p_funding_account_id => p_funding_account_id,
    p_trade_date => p_start_date,
    p_gross_amount => p_principal_amount,
    p_idempotency_key => p_idempotency_key,
    p_notes => 'Fixed deposit principal'
  );

  return v_holding;
end;
$$;

revoke all on function public.create_fixed_deposit(
  text, uuid, uuid, numeric, date, date, uuid, text, numeric, text, text, numeric, text
) from public, anon;
grant execute on function public.create_fixed_deposit(
  text, uuid, uuid, numeric, date, date, uuid, text, numeric, text, text, numeric, text
) to authenticated;

-- 13c. Mature a fixed deposit (or close out a recurring deposit at
-- maturity): race-safe guard identical in spirit to reverse_transaction's
-- (only a currently-'active' row can transition), so the same FD can
-- never be matured twice even under concurrent requests. Interest is
-- always the difference between what comes back and the remaining
-- principal — never a separate guess.
create or replace function public.mature_fixed_deposit(
  p_holding_id uuid,
  p_receiving_account_id uuid,
  p_actual_maturity_amount numeric,
  p_maturity_date date,
  p_idempotency_key uuid,
  p_notes text default null
)
returns public.fixed_income_details
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_holding public.investment_holdings;
  v_details public.fixed_income_details;
  v_locked_id uuid;
  v_receiving_owner uuid;
  v_position record;
  v_interest numeric(20, 4);
  v_income_account_id uuid;
  v_entries jsonb;
  v_transaction public.ledger_transactions;
begin
  if v_user_id is null then
    raise exception 'mature_fixed_deposit requires an authenticated user'
      using errcode = 'insufficient_privilege';
  end if;
  if p_actual_maturity_amount is null or p_actual_maturity_amount < 0 then
    raise exception 'maturity amount cannot be negative' using errcode = 'invalid_parameter_value';
  end if;

  select * into v_holding from public.investment_holdings
    where id = p_holding_id and user_id = v_user_id;
  if v_holding.id is null then
    raise exception 'investment holding not found' using errcode = 'no_data_found';
  end if;
  if v_holding.investment_account_id is null then
    raise exception 'this holding has no linked investment account'
      using errcode = 'invalid_transaction_state';
  end if;

  select user_id into v_receiving_owner from public.accounts where id = p_receiving_account_id;
  if v_receiving_owner is null or v_receiving_owner <> v_user_id then
    raise exception 'receiving account not found' using errcode = 'no_data_found';
  end if;

  select * into v_details from public.fixed_income_details
    where holding_id = p_holding_id and user_id = v_user_id;
  if v_details.id is null then
    raise exception 'fixed income details not found for this holding' using errcode = 'no_data_found';
  end if;

  -- Idempotent retry: if this exact maturity was already posted, return
  -- the current (already-matured) row rather than erroring or reposting.
  if v_details.status = 'matured' then
    if exists (
      select 1 from public.investment_activities
      where holding_id = p_holding_id and idempotency_key = p_idempotency_key::text
    ) then
      return v_details;
    end if;
    raise exception 'this fixed deposit has already matured' using errcode = 'invalid_transaction_state';
  end if;

  update public.fixed_income_details
    set status = 'matured'
    where holding_id = p_holding_id and status = 'active'
    returning id into v_locked_id;

  if v_locked_id is null then
    raise exception 'this fixed deposit is not eligible for maturity (status is not active)'
      using errcode = 'invalid_transaction_state';
  end if;

  select * into v_position from public.investment_holding_position(p_holding_id);
  v_interest := p_actual_maturity_amount - v_position.cost_basis;

  v_entries := jsonb_build_array(
    jsonb_build_object(
      'account_id', p_receiving_account_id,
      'amount', p_actual_maturity_amount::text, 'currency', v_holding.currency
    ),
    jsonb_build_object(
      'account_id', v_holding.investment_account_id,
      'amount', (-v_position.cost_basis)::text, 'currency', v_holding.currency
    )
  );
  if v_interest <> 0 then
    select id into v_income_account_id from public.accounts
      where user_id = v_user_id and system_code = 'uncategorized_income' and is_system = true;
    v_entries := v_entries || jsonb_build_array(
      jsonb_build_object(
        'account_id', v_income_account_id,
        'amount', (-v_interest)::text, 'currency', v_holding.currency
      )
    );
  end if;

  v_transaction := public.post_manual_transaction_for_user(
    v_user_id, 'investment_maturity', (p_maturity_date::text || ' 00:00:00+05:30')::timestamptz,
    'Fixed deposit maturity', v_entries, p_notes, null, null, p_idempotency_key::text
  );

  insert into public.investment_activities (
    user_id, holding_id, activity_kind, trade_date, gross_amount,
    cost_basis_amount, currency, ledger_transaction_id, idempotency_key, notes
  )
  values (
    v_user_id, p_holding_id, 'maturity', p_maturity_date, p_actual_maturity_amount,
    v_position.cost_basis, v_holding.currency, v_transaction.id, p_idempotency_key::text, p_notes
  );

  update public.fixed_income_details
    set actual_maturity_amount = p_actual_maturity_amount
    where holding_id = p_holding_id
    returning * into v_details;

  return v_details;
end;
$$;

revoke all on function public.mature_fixed_deposit(uuid, uuid, numeric, date, uuid, text) from public, anon;
grant execute on function public.mature_fixed_deposit(uuid, uuid, numeric, date, uuid, text) to authenticated;

comment on function public.mature_fixed_deposit is
  'Atomically posts principal return + interest income (balanced, via the '
  'shared posting core) and marks the fixed_income_details row matured. '
  'The guarded UPDATE (status = ''active'' -> ''matured'') only ever '
  'succeeds once, so concurrent maturity attempts serialize on the row '
  'lock and the same FD/RD can never be matured twice.';

-- 13d. Recurring deposit: asset + holding + fixed_income_details + a
-- linked Phase 6 recurring_items row (kind = ''transfer'') so every
-- installment flows through the exact same generation/processing/
-- reminder infrastructure Phase 6 already built — never a second,
-- competing recurrence engine.
create or replace function public.create_recurring_deposit(
  p_display_name text,
  p_investment_account_id uuid,
  p_funding_account_id uuid,
  p_installment_amount numeric,
  p_frequency text,
  p_start_date date,
  p_maturity_date date,
  p_provider text default null,
  p_interest_rate numeric default null,
  p_planned_installments integer default null,
  p_expected_maturity_amount numeric default null,
  p_processing_mode text default 'reminder_only',
  p_interval_count integer default 1,
  p_notes text default null
)
returns public.investment_holdings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_asset public.investment_assets;
  v_holding public.investment_holdings;
  v_recurring_item public.recurring_items;
begin
  if v_user_id is null then
    raise exception 'create_recurring_deposit requires an authenticated user'
      using errcode = 'insufficient_privilege';
  end if;
  if p_installment_amount is null or p_installment_amount <= 0 then
    raise exception 'installment amount must be greater than zero' using errcode = 'invalid_parameter_value';
  end if;
  if p_maturity_date < p_start_date then
    raise exception 'maturity date cannot be before the start date' using errcode = 'invalid_parameter_value';
  end if;

  v_asset := public.create_investment_asset(
    p_asset_kind => 'recurring_deposit', p_display_name => p_display_name, p_unit_precision => 0
  );
  v_holding := public.create_investment_holding(
    p_investment_asset_id => v_asset.id, p_investment_account_id => p_investment_account_id,
    p_opened_date => p_start_date
  );

  v_recurring_item := public.create_recurring_item(
    p_name => p_display_name, p_kind => 'transfer', p_amount => p_installment_amount,
    p_currency => 'INR', p_start_date => p_start_date, p_frequency => p_frequency,
    p_interval_count => p_interval_count, p_processing_mode => p_processing_mode,
    p_source_account_id => p_funding_account_id, p_destination_account_id => p_investment_account_id,
    p_end_date => p_maturity_date
  );

  update public.recurring_items
    set investment_holding_id = v_holding.id
    where id = v_recurring_item.id;

  insert into public.fixed_income_details (
    user_id, holding_id, kind, provider, interest_rate, start_date, maturity_date,
    installment_amount, planned_installments, expected_maturity_amount, recurring_item_id, notes
  )
  values (
    v_user_id, v_holding.id, 'recurring_deposit', p_provider, p_interest_rate, p_start_date,
    p_maturity_date, p_installment_amount, p_planned_installments, p_expected_maturity_amount,
    v_recurring_item.id, p_notes
  );

  return v_holding;
end;
$$;

revoke all on function public.create_recurring_deposit(
  text, uuid, uuid, numeric, text, date, date, text, numeric, integer, numeric, text, integer, text
) from public, anon;
grant execute on function public.create_recurring_deposit(
  text, uuid, uuid, numeric, text, date, date, text, numeric, integer, numeric, text, integer, text
) to authenticated;

-- 13e. Administrative status change for a PPF/FD/RD (closing an already-
-- matured FD/RD, or archiving an old PPF). Maturity itself only ever
-- happens through mature_fixed_deposit (13c) — this never sets 'matured'.
create or replace function public.set_fixed_income_status(p_holding_id uuid, p_status text)
returns public.fixed_income_details
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_details public.fixed_income_details;
begin
  if v_user_id is null then
    raise exception 'set_fixed_income_status requires an authenticated user'
      using errcode = 'insufficient_privilege';
  end if;
  if p_status not in ('active', 'closed', 'archived') then
    raise exception 'unsupported fixed income status: %', p_status
      using errcode = 'invalid_parameter_value';
  end if;

  update public.fixed_income_details
    set status = p_status
    where holding_id = p_holding_id and user_id = v_user_id
    returning * into v_details;

  if v_details.id is null then
    raise exception 'fixed income details not found' using errcode = 'no_data_found';
  end if;

  return v_details;
end;
$$;

revoke all on function public.set_fixed_income_status(uuid, text) from public, anon;
grant execute on function public.set_fixed_income_status(uuid, text) to authenticated;

-- =======================================================================
-- 14. Portfolio, net-worth, allocation, and maturity read functions
-- =======================================================================
-- security invoker throughout this section: every function here queries
-- only RLS-protected tables/views (and public.investment_holding_position,
-- itself security invoker), so results are always scoped to the calling
-- user without a redundant explicit user_id filter — the same pattern
-- Phase 6 already used for budget_summary/budget_category_progress.

-- 14a. Per-holding position, valuation, and gain — the one place every
-- other function in this section reads from, so "current value" is
-- defined exactly once. current_value falls back to cost_basis when no
-- valuation exists (so net worth / totals are always well-defined);
-- has_valuation and unrealized_gain (null when absent) are what the UI
-- uses to distinguish "manually valued" from "cost basis, unvalued" —
-- never silently treating a missing valuation as zero.
create or replace function public.investment_holding_summary()
returns table (
  holding_id uuid,
  investment_asset_id uuid,
  asset_kind text,
  display_name text,
  symbol text,
  currency text,
  status text,
  quantity numeric(20, 6),
  avg_unit_cost numeric(20, 6),
  cost_basis numeric(20, 4),
  has_valuation boolean,
  latest_valuation numeric(20, 4),
  latest_valuation_at timestamptz,
  current_value numeric(20, 4),
  unrealized_gain numeric(20, 4),
  realized_gain numeric(20, 4),
  income_received numeric(20, 4)
)
language sql
security invoker
set search_path = ''
stable
as $$
  with position as (
    select h.id as holding_id, p.quantity, p.cost_basis
    from public.investment_holdings h
    cross join lateral public.investment_holding_position(h.id) p
  ),
  latest_val as (
    select distinct on (v.holding_id) v.holding_id, v.total_value, v.valued_at
    from public.investment_valuations v
    order by v.holding_id, v.valued_at desc
  ),
  realized as (
    select holding_id, coalesce(sum(realized_gain_amount), 0) as total
    from public.investment_activities
    where activity_kind = 'sell' and status = 'posted'
    group by holding_id
  ),
  income as (
    select holding_id, coalesce(sum(gross_amount), 0) as total
    from public.investment_activities
    where activity_kind in ('dividend', 'interest') and status = 'posted'
    group by holding_id
  )
  select
    h.id, h.investment_asset_id, a.asset_kind, a.display_name, a.symbol, h.currency, h.status,
    pos.quantity,
    case when pos.quantity = 0 then null else round(pos.cost_basis / pos.quantity, 6) end,
    pos.cost_basis,
    (lv.holding_id is not null),
    lv.total_value,
    lv.valued_at,
    coalesce(lv.total_value, pos.cost_basis),
    case when lv.holding_id is not null then lv.total_value - pos.cost_basis else null end,
    coalesce(r.total, 0),
    coalesce(inc.total, 0)
  from public.investment_holdings h
  join public.investment_assets a on a.id = h.investment_asset_id
  join position pos on pos.holding_id = h.id
  left join latest_val lv on lv.holding_id = h.id
  left join realized r on r.holding_id = h.id
  left join income inc on inc.holding_id = h.id;
$$;

revoke all on function public.investment_holding_summary() from public, anon;
grant execute on function public.investment_holding_summary() to authenticated;

-- 14b. Whole-portfolio totals, grouped by currency (never combined across
-- currencies — see the file header and section 15 for why). Realized
-- gain/income totals include archived/closed holdings (a completed sale's
-- realized gain is a permanent historical fact); active_holdings_count and
-- missing_valuation_count are active-only. missing_valuation_count is
-- scoped to market-linked kinds (stock/mutual_fund/other_investment) —
-- PPF/FD/RD always have a well-defined cost-basis value with no
-- "unvalued" state to warn about.
create or replace function public.portfolio_summary()
returns table (
  currency text,
  total_invested_cost numeric(20, 4),
  total_current_value numeric(20, 4),
  total_unrealized_gain numeric(20, 4),
  total_realized_gain numeric(20, 4),
  total_income_received numeric(20, 4),
  active_holdings_count integer,
  missing_valuation_count integer
)
language sql
security invoker
set search_path = ''
stable
as $$
  select
    currency,
    coalesce(sum(cost_basis), 0),
    coalesce(sum(current_value), 0),
    coalesce(sum(current_value) - sum(cost_basis), 0),
    coalesce(sum(realized_gain), 0),
    coalesce(sum(income_received), 0),
    count(*) filter (where status = 'active')::integer,
    count(*) filter (
      where status = 'active' and not has_valuation
        and asset_kind in ('stock', 'mutual_fund', 'other_investment')
    )::integer
  from public.investment_holding_summary()
  group by currency;
$$;

revoke all on function public.portfolio_summary() from public, anon;
grant execute on function public.portfolio_summary() to authenticated;

-- 14c. Net worth, grouped by currency. cash_and_bank sums exactly the
-- same account_balances rows Phase 1-6 already used for every
-- non-investment asset account (unchanged behaviour); the value of money
-- sitting in an 'investment'-type account is deliberately NEVER summed
-- from account_balances here — it comes only from
-- investment_holding_summary.current_value, so a rupee is counted exactly
-- once, either as plain cash or as an investment, never both.
create or replace function public.net_worth_summary()
returns table (
  currency text,
  cash_and_bank numeric(20, 4),
  investment_value numeric(20, 4),
  ppf_balance numeric(20, 4),
  fd_value numeric(20, 4),
  rd_balance numeric(20, 4),
  credit_card_outstanding numeric(20, 4),
  other_liabilities numeric(20, 4),
  total_assets numeric(20, 4),
  total_liabilities numeric(20, 4),
  net_worth numeric(20, 4)
)
language sql
security invoker
set search_path = ''
stable
as $$
  with cash as (
    select currency, coalesce(sum(display_balance), 0) as total
    from public.account_balances
    where account_type in ('bank_savings', 'bank_current', 'cash', 'wallet', 'other_asset')
    group by currency
  ),
  cc as (
    select currency, coalesce(sum(display_balance), 0) as total
    from public.account_balances
    where account_type = 'credit_card'
    group by currency
  ),
  other_liab as (
    select currency, coalesce(sum(display_balance), 0) as total
    from public.account_balances
    where account_type in ('loan', 'other_liability')
    group by currency
  ),
  inv as (
    select
      currency,
      coalesce(sum(current_value) filter (
        where asset_kind in ('stock', 'mutual_fund', 'other_investment')
      ), 0) as investment_value,
      coalesce(sum(current_value) filter (where asset_kind = 'ppf'), 0) as ppf_balance,
      coalesce(sum(current_value) filter (where asset_kind = 'fixed_deposit'), 0) as fd_value,
      coalesce(sum(current_value) filter (where asset_kind = 'recurring_deposit'), 0) as rd_balance
    from public.investment_holding_summary()
    where status = 'active'
    group by currency
  ),
  currencies as (
    select currency from cash
    union select currency from cc
    union select currency from other_liab
    union select currency from inv
  )
  select
    c.currency,
    coalesce(cash.total, 0),
    coalesce(inv.investment_value, 0),
    coalesce(inv.ppf_balance, 0),
    coalesce(inv.fd_value, 0),
    coalesce(inv.rd_balance, 0),
    coalesce(cc.total, 0),
    coalesce(other_liab.total, 0),
    coalesce(cash.total, 0) + coalesce(inv.investment_value, 0) + coalesce(inv.ppf_balance, 0)
      + coalesce(inv.fd_value, 0) + coalesce(inv.rd_balance, 0),
    coalesce(cc.total, 0) + coalesce(other_liab.total, 0),
    (coalesce(cash.total, 0) + coalesce(inv.investment_value, 0) + coalesce(inv.ppf_balance, 0)
      + coalesce(inv.fd_value, 0) + coalesce(inv.rd_balance, 0))
      - (coalesce(cc.total, 0) + coalesce(other_liab.total, 0))
  from currencies c
  left join cash on cash.currency = c.currency
  left join cc on cc.currency = c.currency
  left join other_liab on other_liab.currency = c.currency
  left join inv on inv.currency = c.currency;
$$;

revoke all on function public.net_worth_summary() from public, anon;
grant execute on function public.net_worth_summary() to authenticated;

comment on function public.net_worth_summary is
  'Assets minus liabilities, grouped by currency, aggregated entirely in '
  'SQL. Account transfers never appear here (transfers do not change any '
  'account_balances total); investment purchases/contributions move value '
  'from cash_and_bank into investment_value/ppf_balance/fd_value/'
  'rd_balance without changing total_assets. A rupee in an investment '
  'account is counted through investment_holding_summary only, never '
  'through account_balances too — see section 14c above.';

-- 14d. Allocation by asset kind.
create or replace function public.asset_allocation_by_kind()
returns table (
  currency text,
  asset_kind text,
  current_value numeric(20, 4),
  percent_of_portfolio numeric(7, 4)
)
language sql
security invoker
set search_path = ''
stable
as $$
  with by_kind as (
    select currency, asset_kind, coalesce(sum(current_value), 0) as total
    from public.investment_holding_summary()
    where status = 'active'
    group by currency, asset_kind
  ),
  by_currency as (
    select currency, coalesce(sum(total), 0) as total from by_kind group by currency
  )
  select
    k.currency, k.asset_kind, k.total,
    case when c.total = 0 then 0 else round(k.total / c.total * 100, 4) end
  from by_kind k
  join by_currency c on c.currency = k.currency
  order by k.currency, k.total desc;
$$;

revoke all on function public.asset_allocation_by_kind() from public, anon;
grant execute on function public.asset_allocation_by_kind() to authenticated;

-- 14e. Allocation by individual investment asset (aggregated across every
-- holding of that asset, in the unlikely event a user links more than
-- one).
create or replace function public.asset_allocation_by_asset()
returns table (
  currency text,
  investment_asset_id uuid,
  display_name text,
  asset_kind text,
  current_value numeric(20, 4),
  percent_of_portfolio numeric(7, 4)
)
language sql
security invoker
set search_path = ''
stable
as $$
  with by_asset as (
    select currency, investment_asset_id, display_name, asset_kind,
      coalesce(sum(current_value), 0) as total
    from public.investment_holding_summary()
    where status = 'active'
    group by currency, investment_asset_id, display_name, asset_kind
  ),
  by_currency as (
    select currency, coalesce(sum(total), 0) as total from by_asset group by currency
  )
  select
    a.currency, a.investment_asset_id, a.display_name, a.asset_kind, a.total,
    case when c.total = 0 then 0 else round(a.total / c.total * 100, 4) end
  from by_asset a
  join by_currency c on c.currency = a.currency
  order by a.currency, a.total desc;
$$;

revoke all on function public.asset_allocation_by_asset() from public, anon;
grant execute on function public.asset_allocation_by_asset() to authenticated;

-- 14f. Upcoming PPF/FD/RD maturity events within a horizon (default 90
-- days) — "today" computed in Asia/Kolkata, matching every other date
-- boundary in this app.
create or replace function public.upcoming_maturity_events(p_within_days integer default 90)
returns table (
  holding_id uuid,
  display_name text,
  kind text,
  maturity_date date,
  expected_maturity_amount numeric(20, 4)
)
language sql
security invoker
set search_path = ''
stable
as $$
  select h.id, a.display_name, f.kind, f.maturity_date, f.expected_maturity_amount
  from public.fixed_income_details f
  join public.investment_holdings h on h.id = f.holding_id
  join public.investment_assets a on a.id = h.investment_asset_id
  where f.status = 'active'
    and f.maturity_date is not null
    and f.maturity_date <= ((now() at time zone 'Asia/Kolkata')::date + p_within_days)
  order by f.maturity_date;
$$;

revoke all on function public.upcoming_maturity_events(integer) from public, anon;
grant execute on function public.upcoming_maturity_events(integer) to authenticated;

-- 14g. PPF contributions for one Indian financial year (Apr 1 - Mar 31),
-- given that year's start date. No hard-coded government limits or
-- rates anywhere in this function or table — purely a sum of the
-- caller's own recorded contribution activities.
create or replace function public.ppf_financial_year_summary(p_financial_year_start_date date)
returns table (
  holding_id uuid,
  display_name text,
  financial_year_start date,
  financial_year_end date,
  total_contributions numeric(20, 4)
)
language sql
security invoker
set search_path = ''
stable
as $$
  select
    h.id, a.display_name, p_financial_year_start_date,
    (p_financial_year_start_date + interval '1 year' - interval '1 day')::date,
    coalesce(sum(act.gross_amount), 0)
  from public.investment_holdings h
  join public.investment_assets a on a.id = h.investment_asset_id
  join public.fixed_income_details f on f.holding_id = h.id and f.kind = 'ppf'
  left join public.investment_activities act
    on act.holding_id = h.id and act.activity_kind = 'contribution' and act.status = 'posted'
    and act.trade_date >= p_financial_year_start_date
    and act.trade_date < (p_financial_year_start_date + interval '1 year')::date
  group by h.id, a.display_name;
$$;

revoke all on function public.ppf_financial_year_summary(date) from public, anon;
grant execute on function public.ppf_financial_year_summary(date) to authenticated;

-- =======================================================================
-- 15. Row Level Security
-- =======================================================================
-- Table grants are select-only, exactly like Phase 6's four tables — all
-- mutation happens exclusively through the SECURITY DEFINER functions in
-- sections 10-13, which run as the function-owner role and so are
-- unaffected by the absence of insert/update/delete grants here. New
-- policies use `(select auth.uid())` for query-plan caching, per the
-- Phase 7 spec's explicit guidance for newly-added policies (older Phase
-- 1-6 policies are deliberately left as bare auth.uid(), matching their
-- own already-established, already-tested form — not mechanically
-- rewritten here).

alter table public.investment_assets enable row level security;
alter table public.investment_assets force row level security;
alter table public.investment_holdings enable row level security;
alter table public.investment_holdings force row level security;
alter table public.investment_activities enable row level security;
alter table public.investment_activities force row level security;
alter table public.investment_valuations enable row level security;
alter table public.investment_valuations force row level security;
alter table public.fixed_income_details enable row level security;
alter table public.fixed_income_details force row level security;

revoke all on public.investment_assets from public, anon;
revoke all on public.investment_holdings from public, anon;
revoke all on public.investment_activities from public, anon;
revoke all on public.investment_valuations from public, anon;
revoke all on public.fixed_income_details from public, anon;

drop policy if exists investment_assets_select_own on public.investment_assets;
create policy investment_assets_select_own on public.investment_assets
  for select to authenticated
  using (user_id = (select auth.uid()));
grant select on public.investment_assets to authenticated;

drop policy if exists investment_holdings_select_own on public.investment_holdings;
create policy investment_holdings_select_own on public.investment_holdings
  for select to authenticated
  using (user_id = (select auth.uid()));
grant select on public.investment_holdings to authenticated;

drop policy if exists investment_activities_select_own on public.investment_activities;
create policy investment_activities_select_own on public.investment_activities
  for select to authenticated
  using (user_id = (select auth.uid()));
grant select on public.investment_activities to authenticated;

drop policy if exists investment_valuations_select_own on public.investment_valuations;
create policy investment_valuations_select_own on public.investment_valuations
  for select to authenticated
  using (user_id = (select auth.uid()));
grant select on public.investment_valuations to authenticated;

drop policy if exists fixed_income_details_select_own on public.fixed_income_details;
create policy fixed_income_details_select_own on public.fixed_income_details
  for select to authenticated
  using (user_id = (select auth.uid()));
grant select on public.fixed_income_details to authenticated;

-- =======================================================================
-- 16. Indexes
-- =======================================================================

create index if not exists investment_assets_user_id_idx on public.investment_assets (user_id);
create index if not exists investment_assets_status_idx on public.investment_assets (user_id, status);

create index if not exists investment_holdings_user_id_idx on public.investment_holdings (user_id);
create index if not exists investment_holdings_asset_id_idx
  on public.investment_holdings (investment_asset_id);
create index if not exists investment_holdings_account_id_idx
  on public.investment_holdings (investment_account_id)
  where investment_account_id is not null;

create index if not exists investment_activities_holding_trade_date_idx
  on public.investment_activities (holding_id, trade_date desc);
create index if not exists investment_activities_user_id_idx
  on public.investment_activities (user_id);
create index if not exists investment_activities_ledger_transaction_id_idx
  on public.investment_activities (ledger_transaction_id)
  where ledger_transaction_id is not null;

create index if not exists fixed_income_details_user_id_idx on public.fixed_income_details (user_id);
create index if not exists fixed_income_details_recurring_item_id_idx
  on public.fixed_income_details (recurring_item_id)
  where recurring_item_id is not null;
create index if not exists fixed_income_details_maturity_idx
  on public.fixed_income_details (status, maturity_date)
  where maturity_date is not null;

-- Optional Phase 6 foreign-key indexes flagged by the Supabase performance
-- advisor (unindexed_foreign_keys) — a forward-only performance-only
-- addition with no behavioural change to Phase 6.
create index if not exists budget_allocations_category_id_idx
  on public.budget_allocations (category_id);
create index if not exists recurring_items_category_id_idx
  on public.recurring_items (category_id)
  where category_id is not null;
create index if not exists recurring_items_destination_account_id_idx
  on public.recurring_items (destination_account_id)
  where destination_account_id is not null;
create index if not exists recurring_items_payee_id_idx
  on public.recurring_items (payee_id)
  where payee_id is not null;
create index if not exists recurring_items_source_account_id_idx
  on public.recurring_items (source_account_id)
  where source_account_id is not null;
