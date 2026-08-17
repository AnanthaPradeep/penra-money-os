# 06 — Conceptual Data Model

This is a **conceptual** data model: entities, purpose, fields, and relationships in plain language.
It intentionally contains **no SQL, no table DDL, no Supabase-specific syntax** — that belongs to a
later implementation phase (Phase 3 onward). The goal here is to fix the shape of the domain so that
implementation is a translation exercise, not a design exercise.

## 0. Cross-Cutting Design Rules

- **Future multi-user ownership**: every user-owned entity below is designed with a `user_id`
  (owner reference) from day one, even though exactly one user exists in the MVP. No entity should need
  a schema change to become multi-user later — only a change in how `user_id` is populated and enforced
  (Row Level Security, added in the implementation phase).
- **Auditable ledger design**: the Transaction/Transaction Entry pair (§4) implements an auditable,
  double-entry-equivalent ledger: every balance-affecting event is one or more signed entries against
  specific accounts, never a bare balance mutation. This satisfies the requirement for double-entry or
  equivalent auditable ledger logic without requiring full accounting-style debit/credit account
  classification, which would be disproportionate for a personal-finance product.
- **Layered truth**: data is layered into (1) **raw imported data** (Import Batch + the original file),
  (2) **normalized/source-of-truth operational data** (Transaction, Transaction Entry, Investment
  Transaction, Account), and (3) **calculated data** (Holding Snapshot, Net Worth Snapshot, computed
  report figures). Calculated data is always reproducible from normalized data and is never hand-edited.
- **Provenance is mandatory**: any entity created via import carries a reference to its Import Batch;
  any entity influenced by an external data source carries a reference to that source and an effective
  date.
- **Operational vs research separation**: entities that represent the user's own financial position
  (Account, Transaction, Holding) are kept structurally separate from entities that represent external
  research/content (Research Report, Research Source) — the latter is Post-MVP but the separation is
  fixed now so research content can never be confused with, or accidentally influence, the user's actual
  financial records.

## 1. User

- **Purpose**: represents the human who owns all data in the system. Exactly one row exists in the MVP.
- **Important fields**: identity reference (Supabase Auth user id), display name, base currency (INR,
  fixed), locale, timezone (Asia/Kolkata default), financial-year convention (April–March, fixed),
  created-at.
- **Relationships**: the root owner of every other user-owned entity in this model.
- **Ownership**: self-owned.
- **Data sensitivity**: High (identity data).
- **Source of truth**: Supabase Auth for authentication identity; this table for product-level profile
  fields.
- **Audit requirements**: profile changes are audit-logged (Audit Event).
- **MVP**: Yes.

## 2. Institution

- **Purpose**: represents an external financial institution (a specific bank, broker, AMC, insurer,
  EPFO, NPS-CRA) that an Account or Holding is associated with, for grouping and display.
- **Important fields**: name, type (bank/broker/AMC/insurer/other), logo/identifier (non-sensitive),
  country (India, fixed for MVP).
- **Relationships**: referenced by Account and, later, by dedicated asset modules.
- **Ownership**: shared reference data — not user-owned (a curated/extensible lookup list), though a
  user may add a custom institution entry.
- **Data sensitivity**: Low.
- **Source of truth**: manually curated list, extensible by the user.
- **Audit requirements**: None beyond standard change tracking.
- **MVP**: Yes.

## 3. Account

- **Purpose**: represents a bank, cash, wallet, credit card, or loan account the user holds. The
  anchor entity for the transaction ledger.
- **Important fields**: user_id, institution reference (optional), account type (bank/cash/wallet/
  credit_card/loan), display name, currency (INR), opening balance, opening balance date, status
  (active/closed/frozen), last-four-digit identifier (nullable, non-sensitive), credit-card-specific
  fields (credit limit, statement day, due day) when type = credit_card, loan-specific fields (principal,
  rate, EMI amount) when type = loan.
- **Relationships**: has many Transaction Entries; has many Account Balance Snapshots; optionally
  belongs to an Institution.
- **Ownership**: user_id (owned).
- **Data sensitivity**: High.
- **Source of truth**: user-entered/edited; balance is derived from opening balance + Transaction
  Entries, never hand-edited directly once transactions exist.
- **Audit requirements**: all field edits audit-logged.
- **MVP**: Yes.

## 4. Transaction and Transaction Entry (the ledger)

Modelled as **two entities** to achieve auditable, double-entry-equivalent behaviour without full
accounting complexity:

### 4a. Transaction (header)

- **Purpose**: represents a single financial event from the user's perspective — what happened, when,
  why, and how it's categorised. The unit the user thinks in.
- **Important fields**: user_id, date, type (income/expense/transfer/refund/reimbursement/fee/interest/
  dividend), description, category reference, merchant reference (optional), tags, notes, status
  (posted/void), linked import batch (optional), linked original transaction (for refunds/reversals,
  optional).
- **Relationships**: has one or more Transaction Entries (one for income/expense/fee/interest/dividend;
  exactly two, linked, for a transfer); optionally linked to an Import Batch, a Category, a Merchant, and
  a prior Transaction (for refunds/reversals).
- **Ownership**: user_id.
- **Data sensitivity**: High.
- **Source of truth**: manual entry or CSV/PDF import, editable with audit history.
- **Audit requirements**: every create/edit/void generates an Audit Event with before/after values.
- **MVP**: Yes.

### 4b. Transaction Entry (ledger line)

- **Purpose**: the atomic, signed ledger line that actually moves an Account's balance. This is the
  "double-entry-equivalent" building block: a transfer produces two entries (one negative on the source
  account, one positive on the destination account); every other transaction type produces exactly one
  entry.
- **Important fields**: transaction_id (parent), account_id, signed amount, currency, effective date.
- **Relationships**: belongs to one Transaction; belongs to one Account.
- **Ownership**: inherits user_id from its parent Transaction/Account (both must match the same user).
- **Data sensitivity**: High.
- **Source of truth**: generated alongside its parent Transaction; never created independently.
- **Audit requirements**: immutable once posted, except through the same edit/void flow as its parent
  Transaction (both entries of a transfer are edited/voided together, per §7 of
  `05-domain-glossary-and-rules.md`).
- **MVP**: Yes.

## 5. Account Balance Snapshot

- **Purpose**: a periodic, computed record of an Account's balance as of a specific date — the building
  block for account-level history charts and a performance/audit cross-check against the running ledger
  total.
- **Important fields**: account_id, as_of_date, balance, computed_at.
- **Relationships**: belongs to one Account.
- **Ownership**: user_id (via Account).
- **Data sensitivity**: High.
- **Source of truth**: computed/derived (sum of opening balance + Transaction Entries as of the date);
  never manually entered.
- **Audit requirements**: none beyond standard computed-data logging; not user-editable.
- **MVP**: Yes (at least implicitly, to support net-worth history — may be computed on demand rather than
  materialised in early implementation; the entity is defined regardless so history/reporting has a
  stable shape to target).

## 6. Import Batch

- **Purpose**: groups all Transactions created from a single CSV/PDF import operation, preserving
  exactly which source file produced which records.
- **Important fields**: user_id, source document reference, account_id (target account), imported_at,
  row_count, duplicate_count, status (pending review/committed/rolled back), file hash (for
  duplicate-file detection).
- **Relationships**: has many Transactions; references one Document.
- **Ownership**: user_id.
- **Data sensitivity**: High (contains/derives from real transaction data).
- **Source of truth**: created at import time; immutable once committed (a correction is a Transaction
  edit, not a batch rewrite).
- **Audit requirements**: batch commit/rollback is an Audit Event.
- **MVP**: Yes.

## 7. Category

- **Purpose**: a hierarchical label for classifying transactions (e.g., "Food > Groceries").
- **Important fields**: user_id (or system-default, see below), name, parent category reference
  (nullable, for subcategories), type (income/expense-applicable), is_system_default (boolean).
- **Relationships**: referenced by many Transactions; self-referential parent/child.
- **Ownership**: a system-provided default set exists (not user-owned), extensible/customisable per
  user_id.
- **Data sensitivity**: Low.
- **Source of truth**: system defaults + user customisation.
- **Audit requirements**: user edits to custom categories are audit-logged.
- **MVP**: Yes.

## 8. Merchant

- **Purpose**: identifies a payee/merchant across transactions for grouping and reporting (e.g., all
  "Amazon" transactions), independent of exact description text variance.
- **Important fields**: user_id, name, normalized name/aliases, default category (optional, for
  suggestion purposes).
- **Relationships**: referenced by many Transactions.
- **Ownership**: user_id.
- **Data sensitivity**: Medium.
- **Source of truth**: derived from import text patterns + user confirmation/editing.
- **Audit requirements**: standard edit logging.
- **MVP**: Yes.

## 9. Recurring Rule

- **Purpose**: represents a detected or user-defined recurring pattern (e.g., "rent, ~₹X, every month
  around the 1st") used to power recurring-expense detection and (optionally) pre-fill future entries.
- **Important fields**: user_id, pattern definition (merchant/category/amount range, frequency),
  detection confidence, status (confirmed/suggested/dismissed), linked example Transactions.
- **Relationships**: references Merchant/Category; loosely links to matching Transactions.
- **Ownership**: user_id.
- **Data sensitivity**: Medium.
- **Source of truth**: system-detected (computed), user-confirmable/editable.
- **Audit requirements**: user confirmation/dismissal logged.
- **MVP**: Yes (supports the "recurring-expense detection" Should-have; the underlying detection logic
  itself may be simple in the first implementation, but the entity shape is fixed now).

## 10. Subscription

- **Purpose**: a user-tracked recurring payment obligation (distinct from auto-detected Recurring
  Rules — a Subscription is explicit and lifecycle-managed).
- **Important fields**: user_id, service name, amount, currency, billing frequency, next_renewal_date,
  trial_end_date (nullable), payment_account_id, status (active/paused/cancelled), category (optional).
- **Relationships**: belongs to a user; optionally linked to a payment Account; optionally linked to
  matching Transactions for cost verification.
- **Ownership**: user_id.
- **Data sensitivity**: Low–Medium.
- **Source of truth**: manual entry.
- **Audit requirements**: status changes (cancel/pause) audit-logged.
- **MVP**: Yes.

## 11. Instrument

- **Purpose**: represents an investable "thing" — a specific stock (by exchange + symbol/ISIN), mutual
  fund scheme (by AMFI scheme code), or fixed-income product type. Reference data, not a holding.
- **Important fields**: type (stock/mutual_fund/other), identifier (ISIN/scheme code/exchange symbol),
  name, exchange (NSE/BSE where applicable), asset-allocation category (equity/debt/hybrid/gold/etc.).
- **Relationships**: referenced by Investment Transaction, Holding Snapshot, Market Price/Mutual Fund
  NAV.
- **Ownership**: shared reference data (not user-owned); a user may add a custom/unlisted instrument if
  needed.
- **Data sensitivity**: Low.
- **Source of truth**: exchange/AMFI reference data where available; user-added for custom instruments.
- **Audit requirements**: None beyond standard change tracking.
- **MVP**: Yes.

## 12. Investment Transaction

- **Purpose**: the immutable, source-of-truth record of a single investment event (buy, sell,
  contribution, withdrawal, dividend/interest received). See "Investment Transaction" in
  `05-domain-glossary-and-rules.md`.
- **Important fields**: user_id, account_id (the brokerage/holding account, or a Fixed-Income Account for
  PPF/FD/RD), instrument_id (nullable for pure fixed-income contributions), type
  (buy/sell/contribution/withdrawal/dividend/interest), date, quantity/units (nullable where not
  applicable), price per unit (nullable where not applicable), gross amount, fees, net amount, currency.
- **Relationships**: belongs to an Account and (where applicable) an Instrument; aggregated into Holding
  Snapshots.
- **Ownership**: user_id.
- **Data sensitivity**: High.
- **Source of truth**: manual entry (MVP); this is the only writable source for investment figures —
  Holding Snapshot is always derived from this.
- **Audit requirements**: every create/edit/void generates an Audit Event.
- **MVP**: Yes.

## 13. Holding Snapshot

- **Purpose**: the computed, point-in-time aggregation of an Instrument's position within an Account —
  quantity, average cost, invested amount, and (with a paired price) market value and gain/loss. See
  "Holding" in `05-domain-glossary-and-rules.md`.
- **Important fields**: account_id, instrument_id, as_of_date, quantity, average_cost, invested_amount,
  market_value (nullable if no price available), unrealised_gain_loss (nullable), computed_at.
- **Relationships**: derived from all Investment Transactions for that account+instrument up to
  as_of_date, combined with the relevant Market Price/NAV.
- **Ownership**: user_id (via Account).
- **Data sensitivity**: High.
- **Source of truth**: fully computed/derived; never manually entered.
- **Audit requirements**: none (not independently editable); recomputation is logged only if it produces
  a materially different figure than expected (implementation-level concern, not a Phase 0 commitment).
- **MVP**: Yes.

## 14. Market Price

- **Purpose**: a dated price for a stock (or other exchange-traded instrument).
- **Important fields**: instrument_id, date, price, currency, source (manual/provider name), source
  reference (nullable).
- **Relationships**: belongs to an Instrument.
- **Ownership**: shared reference data (not user-owned), though a user's manual entry for their own
  instrument is recorded with a source = "manual" and is scoped to influence only that user's Holding
  Snapshots in the current single-user model.
- **Data sensitivity**: Low (public market data) to Medium (if it reveals what the user holds, combined
  with other data).
- **Source of truth**: manual entry (MVP default) or a future provider adapter; always dated.
- **Audit requirements**: standard change tracking; manual overrides of a provider price are logged.
- **MVP**: Yes (manual entry only; provider-fed automatic prices are a documented Should for a later
  phase, see `03-feature-inventory.md` §8).

## 15. Mutual Fund NAV

- **Purpose**: a dated Net Asset Value for a mutual fund scheme, the mutual-fund-specific analogue of
  Market Price, kept distinct because its authoritative source (AMFI) and update cadence (daily,
  end-of-day) differ structurally from equity prices.
- **Important fields**: instrument_id (scheme), date, nav, source (manual/AMFI), source reference.
- **Relationships**: belongs to an Instrument (type = mutual_fund).
- **Ownership**: shared reference data.
- **Data sensitivity**: Low.
- **Source of truth**: manual entry (MVP default) or AMFI import (documented as a Should for a later
  phase — see `07-data-source-strategy.md`).
- **Audit requirements**: standard change tracking.
- **MVP**: Yes (manual entry only in first release; scheduled AMFI import is Phase 9–10).

## 16. Fixed-Income Account

- **Purpose**: represents a PPF, FD, or RD instrument as an account-like entity with its own terms
  (rate, tenure, maturity), distinct from a brokerage Account because it carries fixed-income-specific
  fields a bank/cash account does not.
- **Important fields**: user_id, type (ppf/fd/rd), institution reference, principal/instalment amount,
  interest rate, start date, maturity date, maturity value (manual or projected — see
  `05-domain-glossary-and-rules.md` "Maturity Value"), status (active/matured/closed).
- **Relationships**: has many Investment Transactions (contributions, interest credits, withdrawal at
  maturity); optionally belongs to an Institution.
- **Ownership**: user_id.
- **Data sensitivity**: High.
- **Source of truth**: manual entry.
- **Audit requirements**: all field edits audit-logged.
- **MVP**: Yes.

## 17. Asset (generic manual asset)

- **Purpose**: a catch-all for asset classes without a dedicated module in MVP — gold, property, EPF,
  NPS, bonds, investment-linked insurance cash value — represented as a single current value with an
  effective date, per §3 of `04-mvp-scope.md`.
- **Important fields**: user_id, name, category (gold/property/epf/nps/bond/insurance/other), current
  value, valuation date, liquidity classification (liquid/non-liquid), notes.
- **Relationships**: contributes to Net Worth Snapshot; not linked to Investment Transactions (no
  transaction-level history in MVP for this entity).
- **Ownership**: user_id.
- **Data sensitivity**: High.
- **Source of truth**: manual entry, re-entered/updated by the user as values change.
- **Audit requirements**: value changes audit-logged (this is exactly the kind of manual valuation where
  silent drift would be most damaging to trust).
- **MVP**: Yes.

## 18. Liability (generic manual liability)

- **Purpose**: a catch-all for debts not modelled as a full Loan Account — informal loans, an
  outstanding ad-hoc obligation — represented the same way as the generic Asset entity.
- **Important fields**: user_id, name, category, current balance, valuation date, notes.
- **Relationships**: contributes (negatively) to Net Worth Snapshot.
- **Ownership**: user_id.
- **Data sensitivity**: High.
- **Source of truth**: manual entry.
- **Audit requirements**: value changes audit-logged.
- **MVP**: Yes.

## 19. Net Worth Snapshot

- **Purpose**: an append-only, computed record of total assets, total liabilities, and net worth as of a
  specific date — the backbone of net-worth history.
- **Important fields**: user_id, as_of_date, total_assets, total_liabilities, net_worth,
  liquid_assets_total, non_liquid_assets_total, computed_at.
- **Relationships**: derived from all Accounts, Holding Snapshots, Fixed-Income Accounts, Assets, and
  Liabilities as of as_of_date.
- **Ownership**: user_id.
- **Data sensitivity**: High.
- **Source of truth**: fully computed/derived; append-only (never overwritten, only superseded by a
  later snapshot).
- **Audit requirements**: none (not user-editable).
- **MVP**: Yes.

## 20. Goal

- **Purpose**: represents a user-defined financial goal (target amount, target date) linkable to real
  account/holding data for progress tracking.
- **Important fields**: user_id, name, target_amount, target_date, linked accounts/holdings (optional),
  status.
- **Relationships**: optionally references Accounts/Holdings for progress computation.
- **Ownership**: user_id.
- **Data sensitivity**: Medium.
- **Source of truth**: manual entry; progress is computed from linked data where linked.
- **Audit requirements**: standard edit logging.
- **MVP**: No (Could-have, documented in `03-feature-inventory.md` §21; entity defined now so a future
  implementation doesn't need to redesign the shape).

## 21. Alert

- **Purpose**: a system-generated or scheduled notice surfaced to the user (upcoming due date, maturity,
  budget threshold, unusual transaction).
- **Important fields**: user_id, type, related entity reference (polymorphic — e.g., an Account, a
  Subscription, a Fixed-Income Account), trigger_date, message, status (pending/shown/dismissed).
- **Relationships**: references the entity it concerns.
- **Ownership**: user_id.
- **Data sensitivity**: Medium (may reveal financial obligations).
- **Source of truth**: computed/generated by scheduled jobs (Phase 10) from underlying data.
- **Audit requirements**: dismissal/interaction logged for tuning purposes (not privacy-sensitive beyond
  standard treatment).
- **MVP**: Yes.

## 22. Document

- **Purpose**: represents an uploaded source file (CSV, PDF statement) stored securely, the basis for
  Import Batches and (later) a general document vault.
- **Important fields**: user_id, file reference (private Storage path), original filename, mime type,
  uploaded_at, purpose (import/reference), linked Import Batch (optional).
- **Relationships**: referenced by Import Batch.
- **Ownership**: user_id.
- **Data sensitivity**: Critical (raw bank/card statements).
- **Source of truth**: the uploaded file itself; this entity is metadata about it.
- **Audit requirements**: upload and access events logged.
- **MVP**: Yes (for import purposes); general document vault (insurance policies, property papers) is
  Post-MVP (see `03-feature-inventory.md` §23).

## 23. Research Report

- **Purpose**: an AI-assisted or curated research note about a company or market condition, kept
  structurally separate from operational financial data (per §0 "operational vs research separation").
- **Important fields**: subject (company/market topic), generated_at, content, linked Research Sources,
  model/provider used (for traceability).
- **Relationships**: has many Research Sources (citations); not linked to any Account, Transaction, or
  Holding directly (a user's holding of a company is a separate fact from a research report about that
  company, to avoid conflating "what I own" with "content I read").
- **Ownership**: not strictly user-owned in the same sense as financial data — could be shared reference
  content (same report useful to any user researching the same company) or user-scoped depending on
  future personalisation decisions (open decision, see `11-open-decisions-and-risks.md`).
- **Data sensitivity**: Low (does not itself reveal the user's financial position).
- **Source of truth**: generated content, always paired with cited Research Sources for explainability
  (Product Principle 3).
- **Audit requirements**: generation event logged, including which AI provider/model produced it.
- **MVP**: No (Post-MVP, Phase 11–12).

## 24. Research Source

- **Purpose**: a citation — the specific external source (a filing, an article, a data-provider
  response) that a Research Report's claims are traceable to.
- **Important fields**: url_or_reference, publisher, retrieved_at, source type (filing/news/market-data).
- **Relationships**: belongs to one or more Research Reports.
- **Ownership**: shared reference data.
- **Data sensitivity**: Low.
- **Source of truth**: the external source itself; this entity is a structured citation to it.
- **Audit requirements**: None beyond standard change tracking.
- **MVP**: No (Post-MVP, Phase 11–12).

## 25. Audit Event

- **Purpose**: the append-only log of who changed what, when, and how, across every user-owned entity
  that supports "editing with audit history" or "no silent financial-data changes." The structural
  enforcement mechanism for Product Principles 4 and 6.
- **Important fields**: user_id, entity_type, entity_id, action (create/update/delete/void/import), actor
  (the user, or "system" for computed/scheduled actions), before_value (nullable), after_value, occurred_at.
- **Relationships**: polymorphically references any auditable entity.
- **Ownership**: user_id (an audit trail of the user's own data, visible to them).
- **Data sensitivity**: High (mirrors the sensitivity of whatever it's auditing).
- **Source of truth**: itself — the authoritative history of change.
- **Audit requirements**: this entity *is* the audit mechanism; it is itself immutable/append-only (no
  edits or deletes, ever, including by the user, except under a formal data-deletion request per
  `08-security-privacy-and-compliance.md`).
- **MVP**: Yes.

## 26. Entity Relationship Summary

```
User
 ├─ Account (bank/cash/wallet/credit_card/loan) ──┬─ Transaction Entry ── Transaction ── Category
 │                                                  └─ Account Balance Snapshot           └─ Merchant
 ├─ Fixed-Income Account (ppf/fd/rd) ── Investment Transaction ── Instrument ── Market Price / MF NAV
 ├─ Investment Transaction ── Instrument                └─ Holding Snapshot (derived)
 ├─ Asset (generic manual)          ┐
 ├─ Liability (generic manual)      ├─ Net Worth Snapshot (derived)
 ├─ (Accounts + Holdings, derived) ─┘
 ├─ Import Batch ── Document
 ├─ Subscription
 ├─ Recurring Rule
 ├─ Goal (Post-MVP)
 ├─ Alert
 └─ Audit Event (references everything above)

Institution — referenced by Account, Fixed-Income Account (shared reference data)
Research Report ── Research Source (Post-MVP; deliberately not linked into the User's operational graph)
```

## 27. MVP Inclusion Summary

| Entity | MVP |
|---|---|
| User | Yes |
| Institution | Yes |
| Account | Yes |
| Transaction / Transaction Entry | Yes |
| Account Balance Snapshot | Yes |
| Import Batch | Yes |
| Category | Yes |
| Merchant | Yes |
| Recurring Rule | Yes |
| Subscription | Yes |
| Instrument | Yes |
| Investment Transaction | Yes |
| Holding Snapshot | Yes |
| Market Price | Yes (manual entry) |
| Mutual Fund NAV | Yes (manual entry) |
| Fixed-Income Account | Yes |
| Asset (generic manual) | Yes |
| Liability (generic manual) | Yes |
| Net Worth Snapshot | Yes |
| Goal | No |
| Alert | Yes |
| Document | Yes |
| Research Report | No |
| Research Source | No |
| Audit Event | Yes |
