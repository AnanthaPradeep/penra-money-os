# PHASE 0 SUMMARY — PENRA Money OS

> **This document is self-contained.** A new AI session (Claude in VS Code, GitHub Copilot, or any other
> assistant) with no access to prior chat history should be able to read this file plus
> `PHASE_0_STATUS.md` and correctly resume work at Phase 1, without needing to read the other 13
> documents first — though they remain the authoritative detail behind everything summarised here.

## 1. Phase Objective

Produce a complete, internally consistent product foundation for **PENRA Money OS** — a private,
India-focused Personal Money Operating System — before any application code, scaffolding, dependencies,
migrations, or external API connections are created. Phase 0 is documentation-only.

## 2. Final Product Definition

**PENRA Money OS** is a private **Personal Money Operating System**, not an expense tracker. It is
built first as a single-user, privacy-first, read-only-financial-intelligence system for one Indian
personal user (the product owner), architected from day one so it can later extend to multiple users,
family portfolios, and a public SaaS product without a rewrite.

**Core promise**: every number you see is accurate, dated, and explainable — and nothing changes
without your knowledge.

## 3. Confirmed Scope

### In the Personal MVP (delivered across Roadmap Phases 1–14)
- **Accounts**: bank, cash, wallet, credit card, basic loan/liability — manual opening balances, status,
  last-four-digit identifiers.
- **Transactions**: income, expense, transfer, refund, reimbursement, fee, interest, dividend — manual
  entry, editing with audit history, CSV import with duplicate detection, categorisation, tags/notes,
  search/filters.
- **Expenses**: categories/subcategories, monthly budgets, monthly and FY-aligned (April–March) annual
  reports, merchant tracking, recurring-expense detection, unusual-expense flags, savings rate.
- **Credit cards**: limit, statement date, due date, total/minimum due, available credit, utilisation,
  annual-fee reminder, EMI tracking — metadata only (name, issuer, last four digits — never full number,
  CVV, PIN, or OTP).
- **Subscriptions**: name, amount, frequency, next renewal, trial expiry, payment account, lifecycle
  status, cost aggregation.
- **Investments (manual tracking)**: Indian stocks, mutual funds, PPF, FD, RD — buy/sell/contributions/
  withdrawals, units/quantity, average cost (weighted-average method), invested amount, current value,
  realised/unrealised gain/loss, XIRR, asset allocation, dated valuations with source.
- **Net worth**: assets, liabilities, current net worth, net-worth history/snapshots, liquid vs
  non-liquid split, investment allocation, month-over-month change, manual asset valuation — including a
  **generic manual Asset/Liability entity** as the MVP mechanism for gold, real estate, EPF, NPS, bonds,
  and investment-linked insurance (single value + date, no dedicated module).
- **Dashboard**: net worth, total assets/liabilities, available cash, monthly income/expense, savings
  rate, credit-card outstanding, investment value, upcoming bills/subscriptions/FD-RD-PPF reminders,
  important alerts.
- **Alerts**: bills/EMIs, credit card due dates, subscription renewals/trials, FD/RD/PPF maturity,
  budget thresholds, unusual transactions — in-app in MVP.
- **Documents**: statement upload for CSV import, with document-to-import-batch provenance.

### Explicitly out of MVP / permanent non-goals (see `04-mvp-scope.md` §4 and §12)
- Direct bank login, bank scraping, storing banking passwords, reading OTPs, automatic payment
  initiation, stock/MF order placement, algorithmic trading, public personalised buy/sell
  recommendations, tax filing, loan underwriting, credit scoring, production Account Aggregator
  integration, family accounts, multi-user collaboration, admin dashboard, paid subscriptions,
  cryptocurrency trading, fully autonomous AI financial decisions.
- Dedicated EPF/NPS/bond/gold/property/insurance modules (generic manual asset entry only, in MVP).
- PDF statement import (CSV only in MVP).
- Goals module, tax support, market/company research, AI insights, family finance, public SaaS
  capabilities — all Post-MVP, sequenced in Roadmap Phases 11, 12, and 15.

## 4. Key Architecture Decisions (full detail in `09-architecture-decisions.md`)

1. Supabase (PostgreSQL + Auth + Storage + Edge Functions) is the backend.
2. **Row Level Security from the first schema**, not retrofitted — every user-owned table designed with
   `user_id` from day one, even with one user.
3. Ledger design: **Transaction + Transaction Entry** pair implements double-entry-equivalent, auditable
   bookkeeping; a transfer produces two linked signed entries and is structurally excluded from
   income/expense reporting.
4. **Decimal-only money** — binary floating-point is permanently prohibited for any monetary value or
   calculation.
5. Weighted-average investment costing, with lot-level detail retained for future FIFO/other-method
   recomputation.
6. **Provider-adapter architecture** for every external data and AI integration — no vendor is
   hard-coded; no vendor is contracted yet.
7. Snapshot-based, append-only net-worth history (never silently rewritten by later corrections).
8. Immutable import provenance — Import Batches and source Documents are never rewritten; corrections
   happen at the Transaction level.
9. Layered data model: raw imported → normalized operational → calculated/derived, kept structurally
   distinct throughout.
10. Research content (Post-MVP) structurally separated from the user's operational financial graph.
11. Next.js (TypeScript) responsive PWA first; Expo React Native later; shared TypeScript domain
    packages once a second client exists.

## 5. Security Rules (full detail in `08-security-privacy-and-compliance.md`)

**Never store, anywhere, under any circumstance**: CVV, PIN, OTP, net-banking passwords, UPI PIN, full
card numbers, full magnetic-stripe data, broker passwords, or plaintext API secrets. Only last-four-digit
card/account identifiers may be stored. RLS is mandatory from Phase 2 onward. Client code only ever uses
the Supabase anon/publishable key; the service-role key and all third-party provider secrets live
server-side only (Edge Functions). Private Storage only for uploaded documents. Data export and deletion
are standing user rights. Backup/recovery must be actually verified (not assumed) before the product
owner relies on the system as sole source of truth (Phase 13).

## 6. Regulatory Boundaries (full detail in `08-security-privacy-and-compliance.md` §17)

- No direct bank login or scraping, ever — automation, if it ever exists, is only via a regulated
  Account Aggregator (AA) path, itself gated on legal review and FIU eligibility (not pursued in current
  scope).
- Investment research/insight features must stay inside "explainable observation about the user's own
  data," never cross into personalised SEBI-regulated Investment Adviser or Research Analyst territory —
  that boundary is a **legal determination**, not a product-team call, and must be reviewed before any
  Post-MVP research/insight feature is built for public use.
- **India DPDP Act, 2023**: received presidential assent 11 August 2023; MeitY notified the associated
  DPDP Rules on **13 November 2025**, to come into force in a staggered approach (verified via web search
  during this Phase 0 session, 2026-08-16 — see `12-research-sources.md` §9). Formal legal review before
  public release must account for the now-notified Rules, not just the base Act.
- Formal legal/compliance review is a hard gate before any Phase 15 public-facing feature ships — nothing
  in this document set is a substitute for that review.

## 7. Major Entities (full detail in `06-conceptual-data-model.md`)

User · Institution · Account · Transaction / Transaction Entry (the ledger) · Account Balance Snapshot ·
Import Batch · Category · Merchant · Recurring Rule · Subscription · Instrument · Investment Transaction ·
Holding Snapshot · Market Price · Mutual Fund NAV · Fixed-Income Account (PPF/FD/RD) · Asset (generic
manual) · Liability (generic manual) · Net Worth Snapshot · Goal (Post-MVP) · Alert · Document · Research
Report (Post-MVP) · Research Source (Post-MVP) · Audit Event.

Every user-owned entity carries a `user_id` for future multi-user readiness. Audit Event is the
structural enforcement mechanism for "no silent financial-data changes."

## 8. Documents Created (all under `docs/phase-0/`)

| # | File | Contents |
|---|---|---|
| 1 | `00-phase-0-overview.md` | Objective, inputs, fixed assumptions, deliverables, non-goals, DoD, acceptance checklist |
| 2 | `01-product-vision.md` | Vision, problem, positioning, promise, principles, perspectives, success/failure modes |
| 3 | `02-persona-and-jobs-to-be-done.md` | Single Indian personal user persona, JTBD, usage patterns, future personas (out of scope) |
| 4 | `03-feature-inventory.md` | Full feature inventory across 30 domain groupings, with MVP status per feature |
| 5 | `04-mvp-scope.md` | Exact MVP definition, MoSCoW requirements, user journeys, success metrics, acceptance criteria |
| 6 | `05-domain-glossary-and-rules.md` | Terminology, formulas (XIRR, CAGR, average cost, utilisation, etc.), precision/rounding/date/transfer/reversal/duplicate/valuation rules |
| 7 | `06-conceptual-data-model.md` | 25 entities, relationships, ownership, sensitivity, source of truth, audit requirements, MVP status |
| 8 | `07-data-source-strategy.md` | Per-category data source strategy (manual, CSV, PDF, broker, prices, NAV, EPF/NPS, news, AI) |
| 9 | `08-security-privacy-and-compliance.md` | Data classification, prohibited data, RLS/auth/encryption, DPDP/SEBI/AA considerations |
| 10 | `09-architecture-decisions.md` | 18 ADRs covering backend, ledger, money handling, provider abstraction, client strategy |
| 11 | `10-product-roadmap.md` | 16 phases (0–15) with objective, deliverables, dependencies, exclusions, verification, exit criteria |
| 12 | `11-open-decisions-and-risks.md` | Confirmed decisions, assumptions, open decisions (none blocking), risk register |
| 13 | `12-research-sources.md` | 11 authoritative sources with verified-or-flagged status; MeitY/DPDP finding of note |
| 14 | `PHASE_0_SUMMARY.md` | This document |
| — | `PHASE_0_STATUS.md` | Living cross-agent continuation tracker (repository root of the doc set) |

## 9. Open Decisions

**No blocking decisions exist.** All open items are deferred to the specific future phase where they
must actually be resolved (see `11-open-decisions-and-risks.md` §3 for the full table), including:
exact monetary storage representation (`NUMERIC` vs. integer minor units, Phase 3), auth method details
(Phase 2), snapshot cadence (Phase 6), roadmap phase assignment for dedicated EPF/NPS/bond/gold/
property/insurance modules (currently unphased), Research content ownership model (Phase 11), MFA
mechanism (Phase 13), and public-product business model/AA pursuit (Phase 15).

## 10. Risks (highest priority per category — full register in `11-open-decisions-and-risks.md` §5)

Product: silent inaccuracy eroding trust. Data: data loss once the product is the sole system of record.
Security: RLS misconfiguration once multi-user exists. Regulatory: drifting into investment-advisory
territory via insight/research features. Cost: Supabase/provider cost growth at public scale. Vendor:
single AI/data-provider lock-in. Scope: MVP expanding informally without updating the scope documents.

## 11. Verification Performed

- Full workspace inspection at session start confirmed an empty directory — no prior work existed to
  preserve or conflict with.
- All 10 authoritative research-source organisations in `12-research-sources.md` were checked via live
  fetch or web search during this session (dated 2026-08-16); none of the "Last verified" dates or facts
  in that document are fabricated. Two live fetches (NSE, MeitY) fell back to corroborating web search
  after direct fetch issues (timeout / 403); this is disclosed explicitly in that document rather than
  presented as an equivalent direct verification.
- A notable, materially useful finding from that verification: **India's DPDP Rules were notified by
  MeitY on 13 November 2025** — this sharpens the legal-review requirement in
  `08-security-privacy-and-compliance.md` §17 from "an Act exists" to "an Act plus its implementing
  Rules now exist," which should inform the scope of the formal legal review required before Phase 15.
- Cross-document consistency was checked as part of the closing quality pass (§12 below) — contradictions
  found were corrected before this summary was finalised; see `PHASE_0_STATUS.md` for the specific pass
  record.

## 12. Phase 0 Definition of Done — Result

All 15 Definition of Done criteria in `00-phase-0-overview.md` §6, and all 15 items in its acceptance
checklist (§7), were re-checked against the finished document set. Result: **met** — see
`PHASE_0_STATUS.md` for the executed checklist with each item marked. No document proposes storing
CVV/PIN/OTP/banking passwords; no document proposes bank scraping; transfers are excluded from
income/expense everywhere they're discussed; decimal money handling is specified once and referenced
elsewhere; import provenance is mandatory in the data model; every provider integration is described as
replaceable; no code, dependency, or migration exists anywhere in the repository.

## 13. Exact Recommended Starting Point for Phase 1

Per `10-product-roadmap.md`, **Phase 1: Repository and Engineering Foundation** is next, and only after
explicit user approval to leave Phase 0. Its scope is: repository structure decision, Next.js
(TypeScript) project scaffold, linting/formatting/testing tooling, CI baseline, and environment/secret
conventions per `08-security-privacy-and-compliance.md` §14 — explicitly **not** yet a Supabase project,
schema, or any product feature (those begin Phase 2 onward). Phase 1's exit criteria: a clean checkout
builds, lints, and runs a trivial test successfully, with conventions documented for the phases that
follow.

**Do not begin Phase 1 without explicit user approval.**
