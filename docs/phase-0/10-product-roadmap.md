# 10 — Product Roadmap

No dates are included anywhere in this roadmap. Sequencing is expressed purely as phase order and
dependency, per the Phase 0 instruction to avoid estimated completion dates unless explicitly marked
provisional — none are provided here, as no scheduling input exists to base one on.

Phases 1–14 collectively deliver the **Personal MVP** defined in `04-mvp-scope.md`; "MVP complete" is
synonymous with the exit criteria of Phase 14. Phase 15 begins public-product work and is explicitly
gated on the security/legal review described in `08-security-privacy-and-compliance.md`.

---

## Phase 0: Product Foundation

- **Objective**: Establish a complete, internally consistent product foundation before any code exists.
- **Major deliverables**: All documents in this `docs/phase-0/` set.
- **Dependencies**: None.
- **Explicit exclusions**: No code, no scaffolding, no dependencies, no migrations, no external API
  connections.
- **Verification requirement**: The Phase 0 acceptance checklist (`00-phase-0-overview.md` §7) passes in
  full; `PHASE_0_SUMMARY.md` exists and is self-contained.
- **Exit criteria**: Explicit user approval to proceed to Phase 1.

## Phase 1: Repository and Engineering Foundation

- **Objective**: Stand up the empty engineering scaffold the product will be built in — repository
  structure, tooling, and conventions — without building product features yet.
- **Major deliverables**: Monorepo/repository structure decision; Next.js (TypeScript) project scaffold;
  linting/formatting/testing tooling; CI baseline; environment/secret-handling conventions per
  `08-security-privacy-and-compliance.md` §14; initial shared-package structure placeholder (informed by
  ADR-10, not yet populated).
- **Dependencies**: Phase 0 approval.
- **Explicit exclusions**: No Supabase project/schema yet; no application features; no product UI beyond
  a minimal scaffold/health-check page if needed for CI verification.
- **Verification requirement**: A clean checkout builds, lints, and runs a trivial test successfully.
- **Exit criteria**: A working, empty, conventions-documented repository ready for feature work.

## Phase 2: Authentication and Personal Profile

- **Objective**: Enable the single user to sign in securely and hold a minimal profile.
- **Major deliverables**: Supabase project provisioned (dev + prod separation per §14 of the security
  doc); Supabase Auth integrated; User entity/profile (per `06-conceptual-data-model.md` §1) implemented
  with RLS from the first table (ADR-03); base currency/locale/timezone/FY fields fixed to the Phase 0
  assumptions.
- **Dependencies**: Phase 1.
- **Explicit exclusions**: No financial data entities yet; no MFA yet (flagged for Phase 13).
- **Verification requirement**: Sign-in/sign-out works; the profile row is correctly RLS-scoped to the
  authenticated user; a second test user (created only for RLS verification, then removed or retained
  per Phase 3+ testing needs) cannot see the first user's row.
- **Exit criteria**: Secure sign-in works end-to-end against the real Supabase project.

## Phase 3: Accounts and Ledger

- **Objective**: Implement the core auditable ledger — Accounts, Transactions, Transaction Entries — the
  structural heart of the entire product.
- **Major deliverables**: Account, Transaction, Transaction Entry, Account Balance Snapshot, Category,
  Merchant entities (per `06-conceptual-data-model.md` §§3–5, 7–8); decimal monetary handling (ADR-13)
  implemented as the very first money-handling code written; manual transaction entry (income, expense,
  transfer, refund, reimbursement, fee, interest, dividend) with correct transfer-exclusion behaviour
  (`05-domain-glossary-and-rules.md` §7); editing with audit history (Audit Event entity, §25).
  Credit card and loan account types with their specific fields (limit/statement/due-date; principal/
  rate/EMI).
- **Dependencies**: Phase 2.
- **Explicit exclusions**: No CSV import yet; no budgets/subscriptions yet; no investments yet.
- **Verification requirement**: A representative set of manual transactions across all types produces
  mathematically correct account balances, and a transfer never appears in an income/expense total, in
  an automated test.
- **Exit criteria**: A user can manually build and maintain an accurate multi-account ledger, including
  credit card and loan accounts, with full audit history.

## Phase 4: Transaction Import and Categorisation

- **Objective**: Remove the need to hand-type historical transactions.
- **Major deliverables**: Document entity + private Storage upload (per ADR-04); Import Batch entity;
  CSV import with column mapping; duplicate detection (`05-domain-glossary-and-rules.md` §9);
  categorisation (manual + suggested); tags/notes; transaction search and filters; Merchant-based
  grouping.
- **Dependencies**: Phase 3.
- **Explicit exclusions**: PDF import (documented Should, not built here); auto-detected recurring rules
  (Phase 5).
- **Verification requirement**: Importing a representative multi-month CSV statement correctly creates
  transactions, correctly flags at least one deliberately-duplicated row, and every imported transaction
  is traceable to its Import Batch and source Document.
- **Exit criteria**: A real bank/card CSV statement can be imported, reviewed, and committed without
  hand-typing each row.

## Phase 5: Budgets and Subscriptions

- **Objective**: Add the recurring-obligation and spending-discipline layer on top of the ledger.
- **Major deliverables**: Category/subcategory budgets; monthly and FY-aligned annual reports; merchant
  tracking refinements; Recurring Rule entity and recurring-expense detection; unusual-expense flagging;
  savings-rate calculation; Subscription entity with full lifecycle (active/paused/cancelled) and
  monthly/annual cost aggregation.
- **Dependencies**: Phase 4 (needs a populated transaction history to detect patterns against).
- **Explicit exclusions**: Alert delivery/notifications (Phase 10); auto-detection of subscriptions from
  transactions (documented Could, not built here).
- **Verification requirement**: A budget correctly reflects actual category spend excluding transfers;
  savings rate matches an independent manual calculation for a test period.
- **Exit criteria**: The user can budget by category and track all subscriptions with accurate
  aggregated cost.

## Phase 6: Net Worth and Dashboard

- **Objective**: Deliver the product's headline promise — a single, accurate, historical net worth
  view — using only the account/ledger data that exists by this phase (investments arrive in Phase 7–9
  and extend it further).
- **Major deliverables**: Asset and Liability entities (generic manual, per `06-conceptual-data-model.md`
  §§17–18); Net Worth Snapshot entity and computation (ADR-14); liquid vs non-liquid classification;
  month-over-month change; the main Dashboard view (net worth, total assets/liabilities, available cash,
  monthly income/expense, savings rate, credit-card outstanding — investment/upcoming-bill/reminder tiles
  populate further as later phases land).
- **Dependencies**: Phase 5.
- **Explicit exclusions**: Investment-derived net worth contributions (arrive in Phase 7–9 and
  automatically flow into net worth once those entities exist, without a Phase 6 redesign, per the
  layered-data ADRs).
- **Verification requirement**: Net worth computed by the system matches an independent manual
  calculation for a representative test dataset; a snapshot taken today is not altered by a later data
  correction (ADR-14 behaviour verified).
- **Exit criteria**: A working, accurate net worth figure and history exist, backed entirely by real
  ledger data.

## Phase 7: Investment Foundation

- **Objective**: Build the shared investment infrastructure (Instrument, Investment Transaction, Holding
  Snapshot, Market Price, Mutual Fund NAV, costing method) that stocks, mutual funds, and fixed-income
  tracking all build on top of — without yet exposing a specific asset-class UI.
- **Major deliverables**: Instrument, Investment Transaction, Holding Snapshot entities
  (`06-conceptual-data-model.md` §§11–13); weighted-average costing implementation
  (`05-domain-glossary-and-rules.md` §4); Market Price and Mutual Fund NAV entities with manual entry;
  XIRR/CAGR calculation implementation as shared, tested domain logic (ADR-10).
- **Dependencies**: Phase 6 (net worth must exist to receive investment contributions once built).
- **Explicit exclusions**: Any specific asset-class UI (Phase 8–9); any automated price/NAV feed
  (documented future work).
- **Verification requirement**: XIRR and weighted-average cost calculations are verified against
  independently-computed reference values for representative multi-cash-flow test cases.
- **Exit criteria**: The shared investment engine is correct and tested, ready for asset-class-specific
  UI on top of it.

## Phase 8: Stocks and Mutual Funds

- **Objective**: Expose stock and mutual fund tracking to the user on top of the Phase 7 foundation.
- **Major deliverables**: Buy/sell/dividend entry UI for stocks; purchase/redemption/SIP entry UI for
  mutual funds; fund category/asset-allocation tagging; holdings views showing quantity, average cost,
  invested amount, current value, realised/unrealised gain/loss, XIRR; investment allocation view feeding
  into the Dashboard and net worth.
- **Dependencies**: Phase 7.
- **Explicit exclusions**: Automated NSE/BSE price feed or AMFI NAV feed (manual entry only in this
  phase; scheduled import lands in Phase 9–10 infrastructure); broker API integration.
- **Verification requirement**: A representative multi-transaction stock and mutual fund portfolio
  (including at least one SIP series) produces correct computed figures, cross-checked manually.
- **Exit criteria**: The user can fully track real stock and mutual fund holdings, correctly reflected
  in net worth.

## Phase 9: PPF, FD, and RD

- **Objective**: Extend investment tracking to India's core fixed-income personal-savings instruments.
- **Major deliverables**: Fixed-Income Account entity (`06-conceptual-data-model.md` §16) for PPF/FD/RD;
  contribution and interest-crediting entry; maturity date/value tracking with clear "projection, not
  guarantee" labelling where computed (`05-domain-glossary-and-rules.md` "Maturity Value"); integration
  into net worth and the dashboard's FD/RD/PPF-reminder-ready data (delivery of the reminder itself is
  Phase 10).
- **Dependencies**: Phase 7 (shares the Investment Transaction foundation).
- **Explicit exclusions**: PPF extension-block tracking; RD missed-instalment flagging (both documented
  Could-haves).
- **Verification requirement**: Maturity value calculations match independently-computed reference
  values for representative PPF/FD/RD scenarios.
- **Exit criteria**: The user can fully track real PPF, FD, and RD holdings, correctly reflected in net
  worth.

## Phase 10: Alerts and Scheduled Jobs

- **Objective**: Make the product proactive — surface what needs attention before it's missed — and
  stand up the scheduled-job infrastructure that later automated data-ingestion phases will reuse.
- **Major deliverables**: Alert entity and generation logic (`06-conceptual-data-model.md` §21) for
  upcoming bills/EMIs, credit card due dates, subscription renewals/trial-ends, FD/RD/PPF maturities, and
  budget thresholds; unusual-transaction alerts; scheduled-job infrastructure (ADR-06) with failure
  logging; Dashboard's "upcoming" and "important alerts" tiles fully populated.
- **Dependencies**: Phases 3–9 (alerts reference entities from all of them).
- **Explicit exclusions**: Mobile push notifications (require the Phase 15+ mobile app); email delivery
  is a possible in-scope channel but not a hard requirement — in-app alert surfacing is the MVP baseline.
- **Verification requirement**: A test scenario with a near-term due date, renewal, and maturity each
  correctly produces an Alert ahead of the event.
- **Exit criteria**: The user reliably sees upcoming financial events in-app before they occur.

## Phase 11: Company and Market Research

- **Objective**: Introduce read-only, source-cited company/market research — explicitly separated from
  the user's operational financial data (ADR-18).
- **Major deliverables**: Research Report and Research Source entities; company fundamentals lookup;
  corporate filings summary; market index tracking; market news aggregation — every item sourced and
  dated.
- **Dependencies**: Phase 7 (instruments must exist to research); a licensed data-provider adapter must
  be selected per `07-data-source-strategy.md` before this phase can integrate real data.
- **Explicit exclusions**: Any personalised recommendation language; any feature that reads as
  investment advice (§7 of `08-security-privacy-and-compliance.md` boundary applies from this phase
  onward).
- **Verification requirement**: Every piece of displayed research content has a visible, working source
  citation and date.
- **Exit criteria**: The user can research a company/market topic they hold or are curious about, with
  full source traceability.

## Phase 12: Explainable AI Insights

- **Objective**: Introduce AI-generated insight over the user's own data and over research content,
  bound by the explainability principle from the start.
- **Major deliverables**: AI provider adapter (ADR-15); explainable spend-pattern insight; explainable
  portfolio insight; natural-language financial Q&A over the user's own data — every insight linked to
  the source data/Research Source it was derived from.
- **Dependencies**: Phase 5 (spend data), Phase 8–9 (portfolio data), Phase 11 (research content) — this
  phase draws on all prior data domains.
- **Explicit exclusions**: Any autonomous action taken by the AI; any prescriptive "buy/sell/do this"
  language.
- **Verification requirement**: A sample of generated insights is manually reviewed to confirm every
  claim traces to real, cited source data.
- **Exit criteria**: AI insight features are live, explainable, and provider-swappable in practice (not
  just in architecture).

## Phase 13: Security Hardening and Backup

- **Objective**: Harden the system before it is trusted as the user's sole financial system of record.
- **Major deliverables**: MFA enabled; dependency-vulnerability process in active use; backup/recovery
  verified (a real restore drill, not just an assumption); data export implemented; log-redaction audit
  performed against §19 of `08-security-privacy-and-compliance.md`; a lightweight incident-response
  runbook for the single-user stage.
- **Dependencies**: All prior phases (this hardens what already exists).
- **Explicit exclusions**: Full public-product-scale incident response planning (Phase 15).
- **Verification requirement**: A backup restore is actually performed and verified against a known
  dataset; a full pass of the `08-security-privacy-and-compliance.md` prohibited-data checklist finds no
  violations anywhere in the implemented system.
- **Exit criteria**: The product owner can rely on the system as sole source of truth with justified
  confidence.

## Phase 14: Personal Production Release

- **Objective**: Formally exit the Personal MVP — the product is in real daily/weekly/monthly/annual use
  by the product owner as their sole financial system of record.
- **Major deliverables**: All MVP Must-Have requirements (`04-mvp-scope.md` §5) verified live; a full
  financial-year (or representative multi-month) cycle exercised end-to-end; MVP release acceptance
  criteria (`04-mvp-scope.md` §11) formally checked off.
- **Dependencies**: Phases 1–13.
- **Explicit exclusions**: Everything in `04-mvp-scope.md` §12 (permanent non-goals) and §4 (out-of-scope
  features) remains excluded.
- **Verification requirement**: The full MVP release acceptance criteria checklist passes.
- **Exit criteria**: PENRA Money OS is the product owner's real, sole, trusted personal financial system
  of record. **This is the completion point of the Personal MVP referenced throughout this document
  set.**
- **Verification requirement**: Explicit user review and sign-off of the Phase 14 exit criteria before
  Phase 15 discovery work begins.

## Phase 15: Public-Product Discovery and Compliance

- **Objective**: Begin — deliberately and separately from personal-use engineering — the discovery,
  legal review, and architectural extension needed to responsibly offer PENRA Money OS beyond a single
  user.
- **Major deliverables**: Formal legal/compliance review (DPDP, SEBI IA/RA boundary, AA/FIU eligibility,
  market-data licensing — per §17 of `08-security-privacy-and-compliance.md`); multi-tenant architecture
  extension built on the existing RLS/`user_id` foundation (ADR-03); business-model and pricing
  discovery; family/household portfolio design; broker/AA integration feasibility; Expo mobile app
  build.
- **Dependencies**: Phase 14 complete; legal review engaged before any public-facing feature ships, not
  after.
- **Explicit exclusions**: No public launch happens as part of "discovery" — this phase produces
  decisions and designs, gated by legal review, not a live public product by default.
- **Verification requirement**: Legal/compliance sign-off obtained for each regulatory boundary in scope
  before the corresponding feature is built for public use.
- **Exit criteria**: A reviewed, legally-sound plan exists for public launch — actual public launch is a
  distinct, later decision point outside this roadmap's current scope.

---

## Roadmap Summary Table

| Phase | Name | Delivers MVP feature area(s) |
|---|---|---|
| 0 | Product Foundation | — (documentation only) |
| 1 | Repository and Engineering Foundation | — (scaffolding only) |
| 2 | Authentication and Personal Profile | Auth |
| 3 | Accounts and Ledger | Accounts, Transactions, Credit cards (data), Loans |
| 4 | Transaction Import and Categorisation | CSV import, Categorisation, Search |
| 5 | Budgets and Subscriptions | Expenses, Income, Budgets, Subscriptions |
| 6 | Net Worth and Dashboard | Net worth, Dashboard (core) |
| 7 | Investment Foundation | Investment engine (no UI yet) |
| 8 | Stocks and Mutual Funds | Stocks, Mutual funds |
| 9 | PPF, FD, and RD | PPF, FD, RD |
| 10 | Alerts and Scheduled Jobs | Alerts, Dashboard (reminders) |
| 11 | Company and Market Research | Market/Company research (Post-MVP) |
| 12 | Explainable AI Insights | AI insights (Post-MVP) |
| 13 | Security Hardening and Backup | Security/backup hardening |
| 14 | Personal Production Release | **MVP complete** |
| 15 | Public-Product Discovery and Compliance | Post-MVP, public-product track |

**Note on unphased asset classes**: EPF, NPS, bonds, gold, property, and dedicated insurance modules
(beyond the generic manual Asset entity available from Phase 6) do not have a specific roadmap phase
assigned. This is recorded as a non-blocking open item in `11-open-decisions-and-risks.md`, to be
resolved at the start of Phase 1 replanning or whenever real demand for a dedicated module arises —
not before.
