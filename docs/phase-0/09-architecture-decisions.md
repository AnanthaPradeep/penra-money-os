# 09 — Architecture Decisions

Consolidated Architecture Decision Records (ADRs) for PENRA Money OS. Each decision is fixed for
planning purposes but not immutable — every ADR includes a **Revisit trigger** describing what would
cause it to be reopened. No code, schema, or dependency is created as a result of these decisions in
Phase 0; they govern implementation from Phase 1 onward.

---

## ADR-01: Supabase PostgreSQL as the planned database

- **Context**: The product needs a relational database capable of enforcing referential integrity,
  supporting row-level access control, and handling ledger-style financial data reliably.
- **Decision**: Use Supabase-managed PostgreSQL as the system of record.
- **Reason**: PostgreSQL's transactional integrity, `NUMERIC` type (for decimal-safe money, see ADR-13),
  and mature RLS support directly serve the product's correctness and privacy requirements; Supabase
  packages this with Auth, Storage, and Edge Functions the product also needs, avoiding multi-vendor
  integration overhead for a single-developer, single-user project.
- **Alternatives considered**: A self-hosted Postgres instance (more operational burden for no current
  benefit); a NoSQL document store (weaker fit for ledger-style relational integrity and auditability);
  Firebase (weaker relational/SQL guarantees for financial-grade data, less natural fit for RLS-style
  per-row ownership at this data shape).
- **Consequences**: The product is structurally coupled to PostgreSQL's data model and Supabase's
  operational platform for the database layer.
- **Risks**: Vendor dependency on Supabase specifically (mitigated somewhat by PostgreSQL being a
  portable, standard engine underneath — a future migration off Supabase's *platform* would not require
  abandoning the *data model*).
- **Revisit trigger**: Supabase pricing/reliability becomes unworkable at public-product scale, or a
  specific technical limitation is hit that a self-hosted/alternative Postgres setup would resolve.

---

## ADR-02: Supabase Auth

- **Decision**: Use Supabase Auth for user authentication and session management.
- **Reason**: Avoids building/maintaining custom credential storage and session logic — a meaningful
  security-risk reduction for a product that must never mishandle authentication for financial data;
  integrates natively with RLS via the authenticated user's JWT claims.
- **Alternatives considered**: A custom auth system (unnecessary risk and effort); a third-party
  identity provider like Auth0/Clerk (adds a vendor and integration surface with no clear benefit over
  the already-adopted Supabase platform).
- **Consequences**: Auth is coupled to Supabase's user model; RLS policies are written against Supabase
  Auth's `auth.uid()` pattern.
- **Risks**: Supabase Auth feature gaps (e.g., specific enterprise SSO needs) could matter at public
  scale.
- **Revisit trigger**: A public-product requirement emerges (e.g., enterprise SSO, specific compliance
  certification) that Supabase Auth cannot satisfy.

---

## ADR-03: Row Level Security from the beginning

- **Decision**: Every user-owned table has RLS enabled and enforced starting with the first schema
  created in Phase 3 — not added retroactively before public launch.
- **Reason**: Retrofitting RLS onto an existing schema and existing data is materially riskier
  (easy to miss a table, easy to introduce a policy bug against real data) than building it in from row
  one, when there is exactly one user and mistakes are low-stakes to catch and fix. This is also the
  core mechanism that makes the eventual multi-user transition additive rather than a rewrite.
- **Alternatives considered**: Application-layer-only access control (rejected — a single application
  bug would then expose all users' data with no database-level backstop); deferring RLS until
  multi-user launch (rejected — highest-risk time to introduce it, and violates the "design for future
  `user_id` ownership" rule from Day 1).
- **Consequences**: Every query path must be written RLS-aware from the start; slightly more setup
  overhead per table even while single-user.
- **Risks**: Misconfigured policies could lock the single user out of their own data if not tested
  carefully during implementation.
- **Revisit trigger**: None expected — this is treated as a permanent baseline, not a temporary
  measure.

---

## ADR-04: Supabase private Storage

- **Decision**: Uploaded documents (CSV/PDF statements, future document vault contents) are stored in a
  private Supabase Storage bucket, accessed only via signed URLs and Storage-level access policies.
- **Reason**: Keeps raw source financial documents (Critical sensitivity, per
  `08-security-privacy-and-compliance.md`) out of any publicly reachable path by default, and keeps
  file storage co-located with the rest of the Supabase-managed stack.
- **Alternatives considered**: A separate object-storage provider (S3, etc.) — rejected for MVP as an
  unnecessary second vendor when Supabase Storage meets the requirement; a public bucket with obscure
  URLs (rejected outright — "security by obscurity" is not acceptable for financial documents).
- **Consequences**: File access always goes through an authenticated, policy-checked path.
- **Risks**: Storage policy misconfiguration could over- or under-expose files; must be tested like any
  RLS policy.
- **Revisit trigger**: A specific need for a specialised storage/CDN capability Supabase Storage cannot
  provide.

---

## ADR-05: Edge Functions for protected external integrations

- **Decision**: Any call to an external provider (market data, AI, future broker/AA APIs) that requires
  a secret key is made from a Supabase Edge Function, never directly from client code.
- **Reason**: Keeps provider API keys server-side only (§5/§8 of `08-security-privacy-and-compliance.md`),
  and gives a natural place to implement the provider-adapter interface (ADR-07) independent of the
  client application's framework.
- **Alternatives considered**: A separate backend server (rejected as unneeded operational overhead
  given Supabase Edge Functions already meet the need); calling providers directly from the client with
  a restricted key where the provider supports it (rejected as inconsistent — not all providers support
  safely-scoped client keys, so a uniform server-side pattern is simpler to reason about and secure).
- **Consequences**: Every external integration has a small server-side function surface to build and
  maintain.
- **Risks**: Edge Function cold-start latency or execution-time limits could matter for specific
  future integrations (e.g., a large PDF parse) — evaluated per integration when built.
- **Revisit trigger**: A specific integration's resource/latency needs exceed what Edge Functions can
  practically provide.

---

## ADR-06: Scheduled jobs for NAV and price updates

- **Decision**: When automated market-data ingestion is built (Phase 9–10+), it runs as a scheduled job
  (e.g., Supabase's scheduled Edge Function / `pg_cron` mechanism), not as an on-request live fetch tied
  to user page loads.
- **Reason**: Market prices/NAVs are inherently daily/periodic data (per `05-domain-glossary-and-rules.md`
  and `07-data-source-strategy.md`); a scheduled pull keeps the data model's "dated valuation" pattern
  consistent, avoids rate-limit/latency issues on user-facing requests, and creates a natural point to
  log fetch failures (per the missing-market-data behaviour rule).
- **Alternatives considered**: On-demand live fetch per page view (rejected — unnecessary provider load,
  inconsistent with "every value has an effective date" since "now" isn't a meaningful market-data
  timestamp outside trading hours anyway); user-triggered manual refresh only (kept as a *complementary*
  option, not a replacement — doesn't preclude scheduled jobs as the primary mechanism).
- **Consequences**: Requires job-scheduling infrastructure and failure-monitoring/logging to be built
  when this phase arrives.
- **Risks**: A failed scheduled job must not silently leave stale data presented as current — mitigated
  by the explicit staleness-indication rule in the domain glossary.
- **Revisit trigger**: A future need for genuinely real-time pricing (not currently a requirement).

---

## ADR-07: Provider-adapter architecture (data + AI)

- **Decision**: Every external data or AI provider is integrated behind an internal adapter interface
  specific to the *capability* (e.g., "get latest NAV," "get latest stock price," "generate an
  explainable insight from these inputs"), never called directly by name throughout the codebase.
- **Reason**: Structurally enforces Product Principle 9 (no single-vendor dependency) and the "replaceable
  AI provider" / "replaceable financial-data providers" fixed assumptions — switching or adding a
  provider becomes a new adapter implementation, not a cross-codebase rewrite.
- **Alternatives considered**: Direct vendor SDK usage throughout the codebase (rejected — creates
  exactly the lock-in the product principles prohibit); a heavyweight generic plugin system (rejected as
  premature complexity for a single-user product with no providers integrated yet — the adapter
  *interface* discipline is adopted now, without over-engineering a plugin marketplace that isn't needed).
- **Consequences**: Slightly more upfront interface design work per integration; pays off the first time
  a provider needs to change.
- **Risks**: A poorly designed adapter interface (too narrow/too vendor-shaped) could still leak
  vendor-specific assumptions — mitigated by designing each adapter interface around the product's own
  domain vocabulary (from `05-domain-glossary-and-rules.md`), not the vendor's API shape.
- **Revisit trigger**: None expected as a standing pattern; individual adapter interfaces may be revised
  as real providers are integrated and their actual constraints become known.

---

## ADR-08: Next.js responsive PWA first

- **Decision**: The first client application is a Next.js (TypeScript) responsive web app, built as an
  installable Progressive Web App.
- **Reason**: A single responsive web codebase reaches desktop and mobile browsers immediately, is
  fastest to iterate on for a single developer, and a PWA gives "app-like" installability without
  committing to native mobile build/release complexity before the product's core correctness is proven.
- **Alternatives considered**: Native mobile-first (rejected — higher build/release overhead before the
  domain model is proven; premature for a single personal user who can use a browser); a
  desktop-only non-responsive app (rejected — the persona's daily/weekly usage patterns, per
  `02-persona-and-jobs-to-be-done.md`, include mobile-context checking).
- **Consequences**: Mobile experience is browser/PWA-based until the Expo app is built.
- **Risks**: PWA capability gaps on iOS (historically more limited than Android for installed-PWA
  features) may constrain some future mobile-specific features (e.g., robust push notifications) until
  the native app exists.
- **Revisit trigger**: A specific MVP requirement turns out to need native-only capability sooner than
  planned (none identified currently).

---

## ADR-09: Expo React Native later

- **Decision**: A native mobile app, built with Expo (React Native), is planned as a later addition
  after the web PWA and core domain model are stable — not built in parallel with the web app from the
  start.
- **Reason**: Avoids splitting limited (single-developer) effort across two client platforms before the
  domain logic and data model have proven correct; Expo allows significant code/tooling reuse with the
  React/TypeScript skillset already invested in the Next.js app.
- **Alternatives considered**: Fully native (Swift/Kotlin) apps (rejected — doubles platform-specific
  effort with no clear benefit for this product's needs); skipping mobile entirely (rejected — the
  persona's usage patterns benefit from a native app, especially for biometric app-lock, per
  `08-security-privacy-and-compliance.md` §16).
- **Consequences**: Mobile-specific features (biometric lock, push notifications) are deferred until
  this phase.
- **Risks**: None specific beyond standard cross-platform mobile framework risk (native module gaps for
  specific hardware features, if ever needed).
- **Revisit trigger**: A public-product business case accelerates the need for native mobile sooner than
  the roadmap currently places it.

---

## ADR-10: Shared TypeScript domain packages

- **Decision**: Domain logic that both the web and future mobile app need (money/decimal handling,
  XIRR/CAGR calculation, validation rules, shared types matching the conceptual data model) is built as
  shared TypeScript package(s), not duplicated per client.
- **Reason**: Product Principle 12 (deterministic, testable calculations) is far easier to guarantee
  with one implementation of each formula, tested once, than with parallel implementations in two
  client codebases that could silently drift.
- **Alternatives considered**: Duplicating logic per client (rejected — direct risk of the two clients
  disagreeing on a calculated financial figure, which would be a serious trust failure per the product's
  core promise); pushing all calculation server-side only (partially adopted where it makes sense — e.g.
  computed Holding/Net Worth Snapshots — but some client-side calculation, like live form validation,
  still benefits from shared logic rather than a round-trip).
- **Consequences**: Requires a monorepo or package-publishing setup once both clients exist (an
  implementation-phase decision, not fixed here).
- **Risks**: Premature abstraction if built before the second (mobile) client exists — mitigated by only
  extracting shared packages when the second consumer is actually being built, not speculatively in
  Phase 1.
- **Revisit trigger**: Evaluated concretely when Expo app work begins (Phase 15+ per the roadmap).

---

## ADR-11: Double-entry / auditable ledger approach

- **Decision**: Use the Transaction + Transaction Entry model described in
  `06-conceptual-data-model.md` §4 — every balance-affecting event produces one or more signed ledger
  entries against specific accounts, rather than direct balance mutation.
- **Reason**: Satisfies the requirement for double-entry-or-equivalent auditable ledger logic, correctly
  models transfers as balance movements without income/expense side effects (Product Principle 14), and
  gives every balance a reconstructible, auditable derivation rather than a mutable stored number.
- **Alternatives considered**: Full formal double-entry accounting (debit/credit account
  classifications, trial balances) — rejected as disproportionate complexity for a personal-finance
  product where the user thinks in "transactions," not accounting entries; simple balance-mutation
  (rejected — loses auditability and makes transfer-exclusion and reversal handling much harder to get
  right).
- **Consequences**: Every Account's balance is always a derived sum, never a directly stored/edited
  field once transactions exist.
- **Risks**: Slightly more complex query logic for "current balance" than a naive stored-balance column
  — mitigated by Account Balance Snapshots for performance where needed.
- **Revisit trigger**: A future feature genuinely requires formal accounting semantics (e.g., business
  bookkeeping) — out of current product scope entirely.

---

## ADR-12: Immutable import provenance

- **Decision**: Import Batches and the Documents they reference are immutable once committed; a
  correction to an imported Transaction is a Transaction-level edit (with audit history), never a
  rewrite of the Import Batch itself.
- **Reason**: Directly implements Product Principle 15 (imported transactions preserve source and
  import-batch provenance) and keeps "where did this data come from" always answerable, even after the
  user has corrected individual records within it.
- **Alternatives considered**: Allowing Import Batches to be edited/re-run in place (rejected — would
  blur the line between "what the source file said" and "what the user later corrected," undermining
  traceability).
- **Consequences**: A bad import isn't "fixed" by editing the batch — it's fixed by editing/voiding the
  resulting Transactions, or the batch is rolled back (its Transactions voided) and re-imported cleanly.
- **Risks**: None significant; slightly more deliberate UX needed for "undo an entire import" flows.
- **Revisit trigger**: None expected.

---

## ADR-13: Decimal monetary calculations

- **Decision**: All monetary values use fixed-point/arbitrary-precision decimal representation
  (PostgreSQL `NUMERIC` at the database layer; a decimal-safe library, not native JS/TS `number`, at the
  application layer) — never binary floating-point.
- **Reason**: Product Principle 13 is non-negotiable; floating-point binary representation cannot
  exactly represent most decimal fractions (including common currency amounts), and compounding
  floating-point rounding error in a system meant to be someone's system of record for their entire
  financial life is an unacceptable correctness risk.
- **Alternatives considered**: Native floating-point with "close enough" display rounding (rejected
  outright — the whole point of Product Principle 13); integer-paisa-only representation everywhere
  (viable alternative, kept as an implementation-phase choice between "integer minor units" and
  "arbitrary-precision decimal type" — both satisfy the non-floating-point requirement; the specific
  choice is deferred to Phase 3 without weakening this ADR's core constraint).
- **Consequences**: Requires a decimal-safe library in the TypeScript layers (e.g., a well-established
  decimal/bignum library) from the first line of money-handling code.
- **Risks**: Developer discipline required to never accidentally coerce a decimal value through a native
  `number` in a calculation path — mitigated by code review discipline and, ideally, lint rules once
  implementation begins.
- **Revisit trigger**: None expected — this is a permanent constraint.

---

## ADR-14: Snapshot-based historical net worth

- **Decision**: Net worth history is built from append-only Net Worth Snapshot records (and Account
  Balance Snapshots), not recomputed retroactively from live data on every historical query.
- **Reason**: Gives stable, fast historical trend data; matches the "valuation snapshot" concept in the
  domain glossary; avoids a scenario where a later data correction silently rewrites what net worth
  *appeared to be* on a past date (which would be misleading) — a snapshot reflects what was known and
  computed as of that date, and if a correction is made later, that shows up as a change from *now*
  forward, not a silent rewrite of history.
- **Alternatives considered**: Fully dynamic recomputation from raw data for any historical date on
  every query (rejected — both a performance concern at scale and philosophically wrong per the
  point above about not silently rewriting historical appearance).
- **Consequences**: Requires a scheduled or triggered snapshot-generation mechanism (Phase 6 onward).
- **Risks**: Snapshot cadence (e.g., daily vs monthly) affects history resolution — a Phase 6
  implementation decision, not fixed here.
- **Revisit trigger**: None expected as a pattern; cadence may be tuned during Phase 6 implementation.

---

## ADR-15: Replaceable AI provider

- **Decision**: No AI feature is built directly against a single AI vendor's SDK/API in product code;
  all AI use goes through the provider-adapter pattern (ADR-07), and provider selection favours vendors
  whose data-retention/training-use terms are compatible with the product's privacy commitments (per
  `08-security-privacy-and-compliance.md` §18).
- **Reason**: Product Principle 9 and the fixed assumption that "AI providers must remain replaceable" —
  the AI landscape changes quickly, and the product's insight/explainability features must not become
  hostage to one vendor's pricing, availability, or policy changes.
- **Alternatives considered**: Direct integration with a single preferred AI vendor for speed (rejected —
  directly contradicts the fixed assumption and Product Principle 9).
- **Consequences**: AI feature implementation (Phase 12) carries adapter-design overhead as described in
  ADR-07.
- **Risks**: None beyond those already covered in ADR-07.
- **Revisit trigger**: None expected as a standing pattern.

---

## ADR-16: Replaceable financial-data providers

- **Decision**: Same pattern as ADR-15, applied to market-data providers (stock prices, NAV, indices,
  fundamentals, news) — all integrated via provider adapters (ADR-07), never hard-coded to one vendor.
- **Reason**: Product Principle 9 and the fixed assumption that external data providers must remain
  replaceable; Indian market-data licensing/access terms can change, and no single provider should
  become a structural dependency.
- **Alternatives considered**: Direct integration with a single data vendor (rejected for the same
  reason as ADR-15).
- **Consequences**: Same as ADR-07/ADR-15, applied to this category.
- **Risks**: None beyond those already covered in ADR-07.
- **Revisit trigger**: None expected as a standing pattern.

---

## ADR-17: Separation of raw imported data, normalized data, and calculated data

- **Decision**: Maintain three distinct data layers throughout the system: (1) raw imported source
  (Documents, Import Batches), (2) normalized operational data (Transactions, Transaction Entries,
  Investment Transactions, Accounts — the source of truth), and (3) calculated/derived data (Holding
  Snapshots, Account Balance Snapshots, Net Worth Snapshots, report aggregates) — per
  `06-conceptual-data-model.md` §0.
- **Reason**: Keeps "what actually happened / what the user entered" cleanly separable from "what the
  system computed from it," which is essential for explainability (Product Principle 3), for safely
  recomputing derived data if a calculation rule changes, and for debugging any figure that looks wrong
  by tracing it back through exactly these layers.
- **Alternatives considered**: Storing computed figures as directly-editable fields alongside source
  data (rejected — reintroduces the risk of derived and source data silently diverging, and undermines
  "no silent financial-data changes").
- **Consequences**: More entities/tables than a flatter design, but each has a single clear
  responsibility.
- **Risks**: None significant; standard derived-data consistency discipline applies (recompute
  deterministically from source, never hand-patch a derived value).
- **Revisit trigger**: None expected.

---

## ADR-18: Separation of operational financial data and research content

- **Decision**: Research Report and Research Source entities are structurally separate from the user's
  operational financial graph (Accounts, Transactions, Holdings) — not foreign-keyed into "what the user
  owns" — per `06-conceptual-data-model.md` §23–24.
- **Reason**: Prevents any accidental conflation between "content the user read about a company" and
  "a fact about the user's own financial position," which matters both for correctness (a research
  report is never a source of truth for what the user holds) and for the regulatory boundary between
  research/insight and the user's actual financial records (§7 of
  `08-security-privacy-and-compliance.md`).
- **Alternatives considered**: Linking research directly to a user's Holding for convenience (rejected —
  blurs the boundary described above; a UI can still *display* research alongside a holding without the
  data model conflating the two).
- **Consequences**: Research features (Phase 11–12) query across two structurally separate domains and
  join them only at the presentation layer.
- **Risks**: None significant.
- **Revisit trigger**: None expected.
