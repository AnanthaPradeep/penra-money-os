-- Adds covering indexes for the Phase 11 foreign-key columns that are
-- actually queried directly (not just displayed) and had no index
-- coverage at all — flagged by Supabase's performance advisor after the
-- Phase 11 migration. Several other flagged FKs (e.g.
-- statement_import_rows.suggested_category_id/suggested_payee_id/
-- matched_rule_id/counterparty_account_id, statement_import_rules.
-- account_id/suggested_category_id/suggested_payee_id) are deliberately
-- left unindexed here: they are only ever read alongside their owning row
-- (never filtered/joined on directly), and at this app's scale (a single
-- user, capped at 2000 rows per import) an extra index there would be
-- pure write-amplification with no real query benefit.

create index if not exists statement_import_rows_linked_created_txn_idx
  on public.statement_import_rows (linked_created_transaction_id)
  where linked_created_transaction_id is not null;

create index if not exists statement_import_row_matches_candidate_row_idx
  on public.statement_import_row_matches (candidate_row_id)
  where candidate_row_id is not null;

create index if not exists statement_import_row_matches_candidate_txn_idx
  on public.statement_import_row_matches (candidate_transaction_id)
  where candidate_transaction_id is not null;

create index if not exists statement_imports_column_mapping_idx
  on public.statement_imports (column_mapping_id)
  where column_mapping_id is not null;
