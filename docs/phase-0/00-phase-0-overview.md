# 00 — Phase 0 Overview

**Product:** PENRA Money OS (working name)
**Phase:** Phase 0 — Product Foundation
**Status:** In progress
**Owner of this document set:** Product/architecture foundation, authored for AI-assisted continuation (Claude in VS Code, GitHub Copilot, or any future coding assistant).

---

## 1. Phase Objective

Produce a complete, internally consistent **product foundation** for PENRA Money OS before any
engineering work begins. Phase 0 exists to answer, in writing and without ambiguity:

- What is this product, and what is it *not*?
- Who is it for, today and later?
- What exactly is in the personal MVP, and what is deliberately excluded?
- What are the domain rules and formulas that any future implementation must follow exactly?
- What is the conceptual shape of the data, without committing to schema syntax?
- Where does data come from, and how is that sourcing kept replaceable?
- What are the security, privacy, and regulatory boundaries the product must never cross?
- What architecture decisions are already fixed, and why?
- What is the build sequence from an empty repository to a personal production release, and beyond
  that to a public product?
- What remains genuinely undecided, and who/when resolves it?

Phase 0 produces **documentation only**. It is the contract that every later phase — and every future
AI coding session — builds on top of, so that no two sessions drift into contradictory assumptions
about what PENRA Money OS is.

## 2. Inputs

- The Phase 0 brief supplied by the product owner (single personal user, India-first, Supabase-backed,
  Next.js/Expo direction, privacy-first, explainable-AI, ledger-grade money handling).
- An empty workspace (`d:\Projects\Penra Finance`) with no prior documentation, code, or decisions —
  confirmed by directory inspection at the start of this session. There was no existing work to
  preserve or continue from.
- No external stakeholder interviews, no existing user base, and no existing codebase. All personas,
  jobs-to-be-done, and feature framing in this document set are derived from the brief and from
  reasonable, explicitly labelled assumptions about Indian personal-finance needs — not from
  primary user research.

## 3. Fixed Assumptions

These are treated as **decided constraints**, not open questions, for the remainder of Phase 0 and
into later phases unless a future phase explicitly revisits them (see `11-open-decisions-and-risks.md`
for the revisit process):

| Assumption | Value |
|---|---|
| Initial market | India |
| Initial user type | One personal user (the product owner) |
| Base currency | INR (Indian Rupee) |
| Default locale | India (en-IN conventions: DD/MM/YYYY display, lakh/crore grouping where appropriate) |
| Default timezone | Asia/Kolkata |
| Financial-year convention | April 1 – March 31 (Indian FY) |
| Product posture | Personal-use first, public product later |
| Data posture | Privacy-first by default |
| Financial intelligence posture | Read-only / observational first — no automated financial actions |
| Payments | No automatic payment initiation, ever, in current scope |
| Trading | No trade/order execution, ever, in current scope |
| Advice | No public personalised investment advice |
| Bank credentials | Never stored |
| Card sensitive data | CVV, PIN, OTP, and full card number are never stored |
| Backend | Supabase (PostgreSQL, Auth, Storage, Edge Functions) is the planned backend |
| External data providers | Must remain replaceable (provider-adapter pattern, not hard-coded) |
| AI providers | Must remain replaceable |
| Data correction | Users must always be able to inspect and correct imported data |
| AI explainability | AI-generated insights must be explainable and traceable to source data |

## 4. Deliverables

All deliverables live under `docs/phase-0/`:

1. `00-phase-0-overview.md` — this document
2. `01-product-vision.md`
3. `02-persona-and-jobs-to-be-done.md`
4. `03-feature-inventory.md`
5. `04-mvp-scope.md`
6. `05-domain-glossary-and-rules.md`
7. `06-conceptual-data-model.md`
8. `07-data-source-strategy.md`
9. `08-security-privacy-and-compliance.md`
10. `09-architecture-decisions.md`
11. `10-product-roadmap.md`
12. `11-open-decisions-and-risks.md`
13. `12-research-sources.md`
14. `PHASE_0_SUMMARY.md` — self-contained handoff summary
15. `PHASE_0_STATUS.md` — living cross-agent status/continuation file (repository root of the doc set, updated throughout Phase 0 and safe to re-read at the start of any future session)

## 5. Non-Goals (Phase 0 Process Non-Goals)

Phase 0 explicitly does **not**:

- Implement any application code
- Scaffold a Next.js, Expo, or any other project
- Install any dependency or package
- Create any Supabase project, table, or migration (SQL or otherwise)
- Connect to any external API (market data, AI, banking, or otherwise)
- Create mock or placeholder implementations of any feature
- Begin UI/UX visual design or component development
- Make binding legal or regulatory determinations (formal legal/compliance review is flagged as
  required before any public release — see `08-security-privacy-and-compliance.md`)

These are process non-goals for *this phase*; they are distinct from the *product* non-goals recorded
in `04-mvp-scope.md` and `10-product-roadmap.md` (e.g., "no trade execution" is a permanent product
boundary at this stage, not just a Phase 0 restriction).

## 6. Definition of Done

Phase 0 is done when all of the following are true:

1. All 14 documents listed in §4 exist, are internally consistent, and cover every section requested
   in the originating brief.
2. `PHASE_0_STATUS.md` accurately reflects a fully completed task list with no stale "in progress"
   markers.
3. The MVP feature set is described identically (in substance) across the vision, feature inventory,
   MVP scope, data model, and roadmap documents — no document contradicts another on what is in or out
   of the personal MVP.
4. Every sensitive data category (bank details, card metadata, investment holdings, personal identity)
   has an explicit ownership and security treatment in `08-security-privacy-and-compliance.md`.
5. No document — anywhere — describes or implies storing CVV, PIN, OTP, net-banking passwords, UPI
   PIN, full card numbers, magnetic-stripe data, or broker passwords.
6. No document proposes direct bank login, bank website scraping, or undocumented API scraping as a
   production data strategy.
7. Investment-related research and insight features are clearly separated from personalised regulated
   financial advice, with the SEBI Investment Adviser / Research Analyst boundary documented.
8. Every market value, NAV, or valuation figure in the domain rules and data model carries an explicit
   effective-date / valuation-timestamp requirement.
9. Transfers between the user's own accounts are explicitly excluded from income/expense treatment
   everywhere they are discussed.
10. Money/decimal handling rules are specified once (in the domain glossary) and referenced, not
    re-invented, elsewhere.
11. Imported data provenance (source + import batch) is a first-class, mandatory concept in the data
    model.
12. Every external/AI data source is described using a replaceable provider-adapter framing.
13. No source code, package manifest, or infrastructure config exists anywhere in the repository as a
    result of this phase.
14. `PHASE_0_SUMMARY.md` is self-contained enough that a new AI session with no chat history could
    read only that file (plus the status file) and correctly resume at Phase 1.
15. Explicit user approval is requested before any Phase 1 work begins.

## 7. Phase 0 Acceptance Checklist

This checklist is re-run in full before Phase 0 is declared complete (see the Quality Checks section
of `PHASE_0_SUMMARY.md` for the executed results):

- [ ] Every Phase 0 document has been read back in full at least once after authoring.
- [ ] No contradictions found between documents (or all found contradictions have been corrected).
- [ ] MVP features are consistent across vision, scope, data model, and roadmap.
- [ ] Non-goals are consistent across all documents that mention them.
- [ ] Single-user-first / public-later positioning is preserved everywhere.
- [ ] All sensitive financial data has a documented ownership and security model.
- [ ] No document suggests storing CVV, PIN, OTP, or banking passwords.
- [ ] No document proposes direct bank scraping.
- [ ] Investment research is separated from personalised regulated advice.
- [ ] Market values and NAVs carry timestamps in the domain model.
- [ ] Transfers are never treated as expenses or income.
- [ ] Decimal (non-floating-point) money handling is specified.
- [ ] Imported data retains source + import-batch provenance.
- [ ] Provider integrations (data + AI) are described as replaceable.
- [ ] No production code or scaffolding exists in the repository.
