# 11 — Open Decisions and Risks

## 1. Confirmed Decisions

These are settled for the current scope and should not be re-litigated without a deliberate, documented
reason:

| # | Decision | Recorded in |
|---|---|---|
| D1 | India-only, INR-only, Asia/Kolkata, April–March FY, single personal user for MVP | `00-phase-0-overview.md` §3 |
| D2 | Supabase (PostgreSQL, Auth, Storage, Edge Functions) as the backend | ADR-01–05, `09-architecture-decisions.md` |
| D3 | Next.js responsive PWA first, Expo React Native later | ADR-08–09 |
| D4 | RLS enabled from the first schema, not retrofitted | ADR-03 |
| D5 | Ledger via Transaction + Transaction Entry (double-entry-equivalent), not full formal accounting | ADR-11 |
| D6 | Decimal-only monetary arithmetic; binary floating-point is prohibited everywhere | ADR-13 |
| D7 | Weighted-average costing as the default investment cost-basis method, with lot-level detail retained | `05-domain-glossary-and-rules.md` §4 |
| D8 | Generic manual Asset/Liability entity as the MVP mechanism for gold, property, EPF, NPS, bonds, and investment-linked insurance | `04-mvp-scope.md` §3, `06-conceptual-data-model.md` §§17–18 |
| D9 | Provider-adapter pattern for all external data and AI integrations | ADR-07, ADR-15, ADR-16 |
| D10 | Manual entry and CSV import precede any bank/broker automation; no bank credential storage or scraping, ever | `07-data-source-strategy.md` §1, `08-security-privacy-and-compliance.md` §2 |
| D11 | Research content structurally separated from operational financial data | ADR-18 |
| D12 | MVP = cumulative output of Roadmap Phases 1–14; Phase 15 begins public-product track, gated on legal review | `10-product-roadmap.md` |

## 2. Assumptions

Recorded per the instruction to "record assumptions instead of blocking on minor unanswered questions."
None of these were stated explicitly in the original brief; each is a reasonable filling of a gap that,
if wrong, would require a document update but not a fundamental product rethink.

| # | Assumption | Why it's safe to assume | Where it would need revisiting |
|---|---|---|---|
| A1 | "Manual asset valuation" in the Net Worth MVP scope includes a generic catch-all for gold/property/EPF/NPS/bonds/insurance, not just accounts/investments explicitly named elsewhere | Keeps net worth meaningfully complete for a real Indian user without expanding MVP to six dedicated modules; low cost if wrong (just remove the generic entity's broader use) | `04-mvp-scope.md` §3, if the product owner wants these excluded entirely from MVP net worth |
| A2 | Weighted-average cost is the MVP costing method, with lot-level detail retained for future FIFO/specific-ID computation | Common approach for mutual funds; avoids a premature, unverified tax-law claim | `05-domain-glossary-and-rules.md` §4, Phase 7, if a specific costing method becomes a hard requirement |
| A3 | Both `NUMERIC` decimal columns and integer-minor-unit representation are acceptable implementations of "decimal-only money," with the specific choice deferred to Phase 3 | Both satisfy Product Principle 13 equally; the choice is an implementation detail, not a product decision | Phase 3 |
| A4 | Alert delivery in MVP is in-app only; email/push are not required for MVP completion | Push requires the mobile app (Post-MVP); email is a reasonable enhancement, not core to the promise | `04-mvp-scope.md` §6, Phase 10 |
| A5 | Audit history applies to every user-owned financial entity, including Asset/Liability manual value changes, not just Transactions | Directly required by Product Principle 6 wherever silent drift could occur | `06-conceptual-data-model.md` §§17–18 |
| A6 | Research Report/Source content, when built, may be shared reference data across future users rather than strictly per-user, since the same company research could serve many users | Simpler and cheaper than per-user duplication; doesn't affect the current single-user product either way | Phase 11, when Research features are actually designed in detail |

## 3. Non-Blocking Open Decisions

None of these fundamentally change the product if answered differently later — they are deferred to the
phase where they must actually be decided, per the instruction not to block on minor unanswered
questions.

| # | Open decision | Owner | Must resolve by |
|---|---|---|---|
| O1 | Exact monetary storage representation: PostgreSQL `NUMERIC` columns vs. integer minor-unit (paisa) columns | Engineering (product owner, as sole engineer at this stage) | Phase 3 |
| O2 | Authentication method: email/password vs. magic link vs. both, via Supabase Auth | Product owner | Phase 2 |
| O3 | Net Worth / Account Balance Snapshot cadence: daily vs. on-demand-computed vs. monthly | Product owner | Phase 6 |
| O4 | Roadmap phase assignment for dedicated EPF, NPS, bond, gold, property, and insurance modules (currently "Unphased" in the feature inventory) | Product owner | Start of Phase 1 replanning, or whenever real demand for a dedicated module arises |
| O5 | Whether Research Report/Source content (Phase 11+) is user-scoped or shared reference data | Product owner | Phase 11 |
| O6 | Alert delivery channels beyond in-app (email, later push) | Product owner | Phase 10 |
| O7 | Exact MFA mechanism (TOTP app vs. other Supabase-supported factor) | Product owner | Phase 13 |
| O8 | Specific market-data, AMFI-feed, and AI provider selection (no vendor is chosen or contracted in Phase 0) | Product owner | Phases 8–12, as each integration is actually built |
| O9 | Whether/when to pursue Account Aggregator (FIU) eligibility at all | Product owner, with legal input | Phase 15 discovery |
| O10 | Public-product business model and pricing | Product owner | Phase 15 discovery |

## 4. Blocking Decisions

**None identified.** No question surfaced during Phase 0 authoring would fundamentally change the
product's definition, architecture, or MVP scope depending on its answer — every open item above is
safely deferrable to the phase where it must actually be resolved. If a genuinely blocking question
arises in a future phase, it should be added here with its specific blocking rationale before that phase
proceeds.

## 5. Risks

### 5.1 Product Risks

| Risk | Description | Mitigation |
|---|---|---|
| Silent inaccuracy erodes trust | A single unexplained wrong number could undermine confidence in the entire system | Traceability, audit history, source-dated valuations (Product Principles 5, 6, 11) |
| Scope creep before correctness | Broad feature coverage built before the ledger/money-math is airtight | MVP discipline in `04-mvp-scope.md` §13 scope-creep guardrails |
| Abandoned personal use | If the product owner stops using it before Phase 14, the "proving ground" premise fails | Keep phases small and independently valuable; each phase should be usable on its own |

### 5.2 Data Risks

| Risk | Description | Mitigation |
|---|---|---|
| Data loss (sole system of record) | The product is meant to become someone's only copy of their financial history | Backup/recovery verification is a Phase 13 requirement and an MVP acceptance criterion (`04-mvp-scope.md` §11) |
| Import misparsing | Bank CSV format variance causes incorrect transaction data | Column-mapping review step, duplicate detection, no silent partial imports (`07-data-source-strategy.md` §2.2) |
| Stale market data presented as current | A failed price/NAV update silently shows an outdated value as if current | Explicit staleness rules (`05-domain-glossary-and-rules.md` §12) |

### 5.3 Security Risks

| Risk | Description | Mitigation |
|---|---|---|
| RLS misconfiguration | A policy bug exposes data across users once multi-user exists | RLS from Phase 2 onward, tested from the start when mistakes are low-stakes (ADR-03) |
| Accidental capture of prohibited data | A stray log or field accidentally captures CVV/OTP/etc. | Explicit permanent prohibition (`08-security-privacy-and-compliance.md` §2), log redaction discipline (§19) |
| Secret leakage | An API key ends up in client code or version control | Edge-Function-only secret usage (ADR-05), environment separation (§14) |

### 5.4 Regulatory Risks

| Risk | Description | Mitigation |
|---|---|---|
| Drifting into investment-advisory territory | Insight/research features gradually read as personalised advice | Explicit SEBI IA/RA boundary documentation (`08-security-privacy-and-compliance.md` §17); legal review gate before Phase 15 public features |
| DPDP non-compliance at public launch | Consent, correction, deletion, and breach obligations not fully met | Formal legal review required before Phase 15 public release; structural groundwork (export/deletion) already planned |
| Market-data/AMFI licensing violation | Redistributing licensed data beyond permitted use | Licensing confirmed per provider before integration (`07-data-source-strategy.md`), never assumed |

### 5.5 Cost Risks

| Risk | Description | Mitigation |
|---|---|---|
| Supabase cost growth at public scale | Personal-use costs are negligible; multi-tenant scale could change this materially | Deferred entirely to Phase 15 discovery; not a concern for the current single-user scope |
| Market-data/AI provider costs | Licensed data and AI API costs could be non-trivial once real integrations begin | Provider-adapter pattern allows cost-driven provider switching without a rewrite (ADR-07) |

### 5.6 Vendor Dependency Risks

| Risk | Description | Mitigation |
|---|---|---|
| Supabase platform lock-in | Deep reliance on Supabase's Auth/Storage/Edge Function ecosystem | PostgreSQL underneath is portable; RLS/schema design isn't Supabase-proprietary (ADR-01) |
| Single AI or data-provider lock-in | Hard-coding one vendor limits future flexibility and negotiating position | Provider-adapter architecture (ADR-07, ADR-15, ADR-16) |

### 5.7 Scope Risks

| Risk | Description | Mitigation |
|---|---|---|
| MVP investment types expanding informally | Someone (even the product owner, mid-implementation) adds "just one more" asset class without updating scope docs | Scope-creep guardrails require updating `03-feature-inventory.md` and `04-mvp-scope.md` before building anything new (§13) |
| Roadmap phases blurring together | Later phases starting before earlier phases' exit criteria are met | Each phase in `10-product-roadmap.md` has an explicit verification requirement and exit criteria |

## 6. Risk Register Summary

| Category | Highest-priority item | Phase most relevant |
|---|---|---|
| Product | Silent inaccuracy | 3–6 (core ledger/net worth) |
| Data | Data loss as sole system of record | 13 |
| Security | RLS misconfiguration | 2–3, 15 |
| Regulatory | Drifting into investment-advisory territory | 11–12, 15 |
| Cost | Supabase/provider cost growth at public scale | 15 |
| Vendor | Single AI/data-provider lock-in | 8, 11, 12 |
| Scope | MVP expanding informally | Throughout 3–14 |

All risks above are tracked for awareness, not resolved in Phase 0 — resolution happens through the
mitigations already designed into the architecture (ADRs) and through the legal/compliance review gate
before Phase 15 public work.
