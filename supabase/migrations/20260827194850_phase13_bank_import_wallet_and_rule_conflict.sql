-- =======================================================================
-- Phase 13 follow-up — closing out two Phase 11 review-UI gaps the Phase
-- 13 spec called out explicitly rather than letting them carry forward
-- silently again:
--
--   1. Wallet pre-assignment during statement-import review.
--      statement_import_rows had no wallet column at all, so a row being
--      reviewed could be given a category/payee/kind but never a purpose
--      wallet (Phase 12, 20260826112813_phase12_purpose_wallets.sql)
--      before posting — the only way to tag an imported expense to a
--      wallet was a second manual step after the fact. This adds a
--      nullable wallet_id to statement_import_rows, threads it through
--      the two review-edit RPCs, and — the actual behavioural change —
--      makes post_statement_import_batch call
--      assign_transaction_to_purpose_wallet for a row that creates a new
--      transaction and carries a wallet_id, exactly once, exactly for the
--      transaction that row itself created.
--
--   2. Equal-priority import-rule conflicts were computed in TypeScript
--      (src/lib/bank-import/rules.ts's evaluateImportRules already
--      returns a `{ status: "conflict", rules }` case when more than one
--      active rule shares the row's top matched priority and they
--      disagree on what to suggest) but the caller
--      (runRowAnalysis in src/lib/bank-import/actions.ts) silently
--      dropped that case on the floor — a conflicted row got no
--      suggestion applied and no signal that a conflict even happened,
--      indistinguishable from "no rule matched at all". This adds a
--      has_rule_conflict boolean statement_import_rows carries so the
--      review UI can show a real "multiple equal-priority rules matched"
--      badge instead of a silently-blank suggestion.
--
-- Both changes touch the same two RPCs
-- (update_statement_import_row, bulk_update_statement_import_rows) whose
-- parameter lists are widened here — per the Phase 11/Phase 12 overload
-- postmortems (20260825170709_phase11_fix_post_manual_transaction_
-- overload.sql, 20260826110024_fix_create_account_with_opening_balance_
-- overload.sql), `create or replace function` with a different parameter
-- list creates a SECOND overload rather than replacing the first, so the
-- stale signature is explicitly dropped before the widened one is
-- created, and a sanity-check DO block confirms exactly one overload
-- survives.
-- =======================================================================

-- =======================================================================
-- 1. statement_import_rows: wallet_id + has_rule_conflict.
-- =======================================================================

alter table public.statement_import_rows
  add column if not exists wallet_id uuid null references public.purpose_wallets (id) on delete set null;

alter table public.statement_import_rows
  add column if not exists has_rule_conflict boolean not null default false;

comment on column public.statement_import_rows.wallet_id is
  'Optional purpose wallet the user pre-selected for this row during review (Phase 12 purpose_wallets). Only ever consumed by post_statement_import_batch when this row goes on to CREATE a new transaction, and only when assign_transaction_to_purpose_wallet''s own rules accept it (posted expense/credit_card_purchase, active wallet, not already assigned) — every other combination is skipped, never hard-failed, so an ineligible pre-selection never blocks posting.';
comment on column public.statement_import_rows.has_rule_conflict is
  'True when this row''s highest-priority matched statement_import_rules had more than one active rule tied at that priority AND those rules disagreed on what to suggest (see evaluateImportRules''s "conflict" case in src/lib/bank-import/rules.ts). The row is left otherwise unsuggested by rules in that case — this flag is what lets the review UI surface the ambiguity instead of it looking like "no rule matched".';

create index if not exists statement_import_rows_wallet_idx
  on public.statement_import_rows (wallet_id) where wallet_id is not null;
create index if not exists statement_import_rows_rule_conflict_idx
  on public.statement_import_rows (import_id) where has_rule_conflict = true;

-- =======================================================================
-- 2. update_statement_import_row — widen with p_wallet_id. Ownership is
--    validated up front (same shape as save_statement_import_rule's own
--    p_account_id check) rather than deferred, since — unlike
--    category_id/payee_id, whose ownership is only ever enforced later by
--    validate_ledger_transaction_refs at actual posting time — a wallet
--    selected here is read back and acted on directly by
--    post_statement_import_batch without going through that trigger.
-- =======================================================================

drop function if exists public.update_statement_import_row(uuid, text, uuid, uuid, text, uuid, text);

create or replace function public.update_statement_import_row(
  p_row_id uuid,
  p_user_decision text default null,
  p_category_id uuid default null,
  p_payee_id uuid default null,
  p_resolved_transaction_type text default null,
  p_counterparty_account_id uuid default null,
  p_notes text default null,
  p_wallet_id uuid default null
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
  if p_wallet_id is not null and not exists (
    select 1 from public.purpose_wallets where id = p_wallet_id and user_id = v_user_id
  ) then
    raise exception 'Wallet not found' using errcode = '42501';
  end if;

  update public.statement_import_rows set
    user_decision = coalesce(p_user_decision, user_decision),
    suggested_category_id = coalesce(p_category_id, suggested_category_id),
    suggested_payee_id = coalesce(p_payee_id, suggested_payee_id),
    resolved_transaction_type = coalesce(p_resolved_transaction_type, resolved_transaction_type),
    counterparty_account_id = coalesce(p_counterparty_account_id, counterparty_account_id),
    notes = coalesce(p_notes, notes),
    wallet_id = coalesce(p_wallet_id, wallet_id)
  where id = p_row_id
  returning * into v_row;

  if v_import_status = 'ready' then
    update public.statement_imports set status = 'reviewing' where id = v_row.import_id;
  end if;

  return v_row;
end;
$$;

revoke all on function public.update_statement_import_row(uuid, text, uuid, uuid, text, uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.update_statement_import_row(uuid, text, uuid, uuid, text, uuid, text, uuid) to authenticated;

do $$
declare
  v_count integer;
begin
  select count(*) into v_count
  from pg_proc
  where proname = 'update_statement_import_row'
    and pronamespace = 'public'::regnamespace;

  if v_count <> 1 then
    raise exception 'expected exactly one update_statement_import_row overload after widening, found %', v_count;
  end if;
end;
$$;

-- =======================================================================
-- 3. bulk_update_statement_import_rows — widen with p_wallet_id, same
--    ownership check and same drop-then-recreate overload discipline.
-- =======================================================================

drop function if exists public.bulk_update_statement_import_rows(uuid, uuid[], text, uuid, uuid);

create or replace function public.bulk_update_statement_import_rows(
  p_import_id uuid,
  p_row_ids uuid[],
  p_user_decision text default null,
  p_category_id uuid default null,
  p_payee_id uuid default null,
  p_wallet_id uuid default null
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
  if p_wallet_id is not null and not exists (
    select 1 from public.purpose_wallets where id = p_wallet_id and user_id = v_user_id
  ) then
    raise exception 'Wallet not found' using errcode = '42501';
  end if;

  update public.statement_import_rows set
    user_decision = case
      when p_user_decision = 'include' and duplicate_status in ('exact_file_duplicate', 'exact_row_duplicate') then user_decision
      else coalesce(p_user_decision, user_decision)
    end,
    suggested_category_id = coalesce(p_category_id, suggested_category_id),
    suggested_payee_id = coalesce(p_payee_id, suggested_payee_id),
    wallet_id = coalesce(p_wallet_id, wallet_id)
  where import_id = p_import_id and id = any(p_row_ids);

  get diagnostics v_count = row_count;

  if v_import.status = 'ready' then
    update public.statement_imports set status = 'reviewing' where id = p_import_id;
  end if;

  updated_count := v_count;
  return next;
end;
$$;

revoke all on function public.bulk_update_statement_import_rows(uuid, uuid[], text, uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.bulk_update_statement_import_rows(uuid, uuid[], text, uuid, uuid, uuid) to authenticated;

do $$
declare
  v_count integer;
begin
  select count(*) into v_count
  from pg_proc
  where proname = 'bulk_update_statement_import_rows'
    and pronamespace = 'public'::regnamespace;

  if v_count <> 1 then
    raise exception 'expected exactly one bulk_update_statement_import_rows overload after widening, found %', v_count;
  end if;
end;
$$;

-- =======================================================================
-- 4. apply_statement_import_row_analysis — same signature (still (uuid,
--    jsonb, jsonb), so a plain create-or-replace is safe, no overload
--    risk), just teaches the row-update loop to persist has_rule_conflict
--    when the TypeScript rule-evaluation pass computed one. p_row_updates
--    element shape gains an optional has_rule_conflict boolean.
-- =======================================================================

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
      has_rule_conflict = coalesce((v_update ->> 'has_rule_conflict')::boolean, has_rule_conflict),
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

-- =======================================================================
-- 5. post_statement_import_batch — same signature (uuid) -> table(...),
--    so a plain create-or-replace is safe. Adds one new behaviour at the
--    end of Path 3 (plain income/expense/credit_card_purchase create):
--    if the row carries a wallet_id and its resolved type is one
--    assign_transaction_to_purpose_wallet actually accepts (expense or
--    credit_card_purchase — income and every transfer-shaped kind are
--    structurally ineligible per that function's own check, so they are
--    filtered here rather than attempted and caught), call it for the
--    transaction this exact row just created.
--
--    Deliberately NOT called in Path 1 (linked_existing_transaction_id):
--    that transaction was not created by this row, it already existed —
--    tagging it to a wallet here would silently claim someone else's
--    already-posted transaction for a wallet the user only meant to
--    apply going forward.
--
--    Deliberately NOT attempted in Path 2 (transfer / credit_card_payment
--    pairing): resolved_transaction_type in that path is always either
--    'transfer' or 'credit_card_payment' (see confirm_statement_transfer_
--    match's v_resolved_type), and assign_transaction_to_purpose_wallet
--    rejects both unconditionally — attempting it there could never
--    succeed under any current rule, so it is skipped rather than adding
--    a call that only ever no-ops.
--
--    The assignment call itself is wrapped in its own sub-block: every
--    rejection assign_transaction_to_purpose_wallet can raise once the
--    type pre-filter has already passed (wallet archived or deleted
--    between review and posting, or — on an idempotent retry that reuses
--    a transaction a prior partial run already tagged — "already
--    assigned to a wallet") is that function's own business rule
--    rejecting this specific row/transaction pair, not a failure of
--    posting itself, so it is swallowed here exactly like every other
--    "this transaction kind isn't wallet-eligible" case rather than
--    failing the whole batch. Nothing about the transaction, its entries,
--    or its posting_result is touched by this block either way.
-- =======================================================================

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

      -- Best-effort wallet pre-assignment for the transaction this row
      -- just created — see this migration's own comment (section 5)
      -- above for exactly why this is the only path it runs from and why
      -- a rejection here is swallowed rather than failing the batch.
      if v_row.wallet_id is not null and v_row.resolved_transaction_type in ('expense', 'credit_card_purchase') then
        begin
          perform public.assign_transaction_to_purpose_wallet(v_new_tx.id, v_row.wallet_id);
        exception when others then
          null;
        end;
      end if;
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
