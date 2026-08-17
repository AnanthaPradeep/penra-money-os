# 08 — Security, Privacy, and Compliance

> **This document does not constitute legal advice.** It records product-level security/privacy
> engineering intentions and flags where formal legal and regulatory review is required before public
> release. Nothing here is an unqualified legal conclusion (see §7).

## 1. Financial-Data Classification

| Class | Examples | Handling baseline |
|---|---|---|
| **Critical** | Any prohibited data (§2) if ever accidentally captured; raw uploaded bank/card statement files; full document vault contents | Must never be stored (prohibited data) or must be stored in private, encrypted, access-controlled Storage with the strictest access policy |
| **High** | Account balances, transaction amounts/descriptions, investment holdings, credit card metadata (limit/dues/last-4), net worth figures, audit events | Row Level Security scoped to the owning user; encrypted at rest and in transit; never logged in plaintext |
| **Medium** | Categories, merchants, subscription names, alerts, recurring-rule patterns | RLS-scoped; standard encryption; lower logging sensitivity but still not exposed cross-user |
| **Low** | System-default categories, public reference data (Institution list, Instrument reference data), public market prices/NAV, published research content | Shared reference data; no special access restriction beyond normal application access control |

This classification governs every access-control, encryption, and logging decision below.

## 2. Explicit Prohibition on Sensitive Authentication/Card Data

PENRA Money OS **must never collect, store, log, cache, or transmit-and-retain** any of the following,
under any circumstance, at any phase:

- CVV (card verification value)
- PIN (card or otherwise)
- OTP (one-time passwords, SMS or app-based)
- Net-banking passwords
- UPI PIN
- Full magnetic-stripe / full card track data
- Full card number (only the **last four digits** may be stored, as non-sensitive metadata, per
  `04-mvp-scope.md` / `06-conceptual-data-model.md`)
- Broker account passwords
- Any API secret or credential in plain text (see §9)

This is a permanent architectural boundary, not a phase-specific restriction. Any future feature
proposal (including AA integration, broker integration, or automated bank sync) must be re-validated
against this list before being built — automation must use consented, token-based, revocable access
patterns (e.g., AA consent flows, OAuth-style broker tokens), never direct credential capture.

## 3. Authentication Expectations

- **MVP**: Supabase Auth, single user, email/password or a Supabase-supported passwordless method
  (magic link) — the exact method is an implementation-phase decision, not fixed here.
- Session tokens are handled via Supabase's standard secure session mechanism; no custom credential
  storage is built.
- **Future MFA**: multi-factor authentication (TOTP or equivalent) is planned as a hardening step before
  public release (Phase 13) and is strongly recommended even in personal use once available, given the
  sensitivity of the data.
- Password reset and account-recovery flows rely on Supabase Auth's built-in mechanisms; no custom
  "security question" or other weaker fallback is introduced.

## 4. Row Level Security (RLS)

- **RLS is required from the very first schema created in Phase 3 onward — not retrofitted later.**
  Every user-owned table (per the `user_id` design rule in `06-conceptual-data-model.md`) must have RLS
  policies restricting all read/write access to rows where `user_id` matches the authenticated user,
  even though only one user exists today.
- Shared reference tables (Institution, Instrument, Category defaults, Market Price/NAV reference rows)
  use appropriately scoped policies — readable broadly, writable only by trusted paths (the user's own
  manual entries, or a future service-role-driven import job).
- This is the single most important structural decision for the eventual multi-user transition: it
  means the transition is a matter of *more rows*, not a schema or access-model rewrite.

## 5. Least Privilege

- The application's client-side (browser/mobile) Supabase key is always the **anon/publishable** key,
  relying on RLS for enforcement — never the service-role key.
- The **service-role key** (which bypasses RLS) is used only in trusted server-side contexts (Supabase
  Edge Functions, scheduled jobs) for specific, narrow operations (e.g., writing shared reference NAV
  data), never exposed to any client.
- Any future external integration (broker API, AA, AI provider) is called from a server-side context
  (Edge Function), never directly from the client, so that provider API keys never reach client code.

## 6. Encryption

- **In transit**: all client-server and server-provider communication uses TLS; no plaintext HTTP path
  exists anywhere in the design.
- **At rest**: Supabase-managed encryption at rest for the PostgreSQL database and Storage is relied
  upon as the baseline; no data is intentionally stored unencrypted outside that managed boundary.
- **Sensitive-field handling**: fields that are sensitive but not prohibited (e.g., last-four digits,
  account balances) rely on RLS + at-rest encryption rather than additional application-level
  field encryption in MVP — application-level encryption of specific fields is a future hardening
  option to evaluate in Phase 13 if warranted, not a Phase 0 commitment.

## 7. Secure File Storage

- Uploaded documents (CSV/PDF statements) are stored in a **private** Supabase Storage bucket, never a
  public bucket, with access mediated by RLS-equivalent Storage policies scoped to the owning user.
- Signed, time-limited URLs are used for any temporary client access to a stored file, never permanent
  public links.
- **Import-file retention**: retained by default (they are the provenance record for imported
  Transactions), but the user can delete a source document; deleting the source document does not
  retroactively delete the Transactions it produced (which retain their own record independent of the
  file, per the Import Batch design) — it only removes the raw file copy.

## 8. API-Secret Handling

- All third-party API keys/secrets (future market-data, AI, broker providers) are stored as Supabase
  Edge Function environment secrets (or an equivalent managed secret store), never committed to the
  repository, never embedded in client-side code, never stored in a database table in plaintext.
- Local development uses a separate, non-production secret set (see §14).

## 9. Audit Logging

- The Audit Event entity (`06-conceptual-data-model.md` §25) is the primary audit mechanism for
  financial-data changes: every create/update/delete/void on a user-owned financial entity is logged
  with before/after values, actor, and timestamp.
- Audit Events are append-only; no update or delete path exists for them, except under a formal
  data-deletion request (§12), which is itself logged as a distinct administrative event.
- Authentication events (login, logout, failed login attempts, password reset) are logged via Supabase
  Auth's own logging; these are reviewed as part of security hardening (Phase 13), not built as a
  custom system.

## 10. Data Export

- The user can export their own data (transactions, holdings, accounts, net worth history) in a
  portable format (e.g., CSV/JSON) on demand. This is a standing requirement, not a future nice-to-have,
  given the product's "you own your data" promise — the exact implementation timing is a roadmap
  decision (see `10-product-roadmap.md`), but the *capability* is a permanent product commitment.

## 11. Data Deletion

- The user can request deletion of their account and all associated data. In the single-user MVP this
  is primarily a personal-use safety net (e.g., wanting to reset and start over); in the future public
  product it directly supports DPDP correction/erasure expectations (§17).
- Deletion is a hard delete of the underlying rows (distinct from the routine soft-delete/void mechanism
  used for day-to-day corrections, per `05-domain-glossary-and-rules.md` §10) and is itself logged as an
  administrative event before the log entry's normal lifecycle applies.

## 12. Backup and Recovery

- Relies on Supabase's managed PostgreSQL backup capabilities as the baseline (point-in-time recovery
  where available on the chosen Supabase plan).
- Before the product owner relies on PENRA Money OS as their **sole** source of truth (an MVP acceptance
  criterion, per `04-mvp-scope.md` §11), backup/recovery must be explicitly verified — not merely
  assumed to work because "Supabase handles it."
- A documented, periodic export (§10) doubles as a personal off-platform backup during the single-user
  phase, independent of Supabase's own backup guarantees.

## 13. Incident Response

- **MVP-stage**: given a single, non-commercial user, incident response is lightweight — primarily
  "detect via audit log/Supabase dashboard anomalies, rotate any exposed secret immediately, assess
  scope."
- **Public-product stage**: requires a formal incident response plan (detection, containment,
  user notification obligations under DPDP, post-incident review) before launch — explicitly deferred to
  Phase 15 planning, not designed in detail here.

## 14. Development vs Production Separation

- A separate Supabase project (or clearly isolated environment) is used for development/testing versus
  the production instance holding real personal financial data, from the first implementation phase
  onward.
- No real financial data is used in a development/testing environment; synthetic/representative test
  data is used instead once implementation begins (this is a data-handling rule for later phases, not
  something Phase 0 needs to produce).
- Separate secrets per environment (§8), never shared across dev/prod.

## 15. Dependency Security

- Once implementation begins, dependencies (npm packages) are kept current and monitored for known
  vulnerabilities (e.g., via `npm audit` or an equivalent tool) as a standing engineering practice — a
  process expectation recorded here for continuity, not a Phase 0 action item since no dependencies
  exist yet.

## 16. Mobile App Lock and Biometrics (Future)

- Once the Expo React Native mobile app exists (post Phase 14/15), an app-level lock (biometric or
  device PIN, via the OS's secure authentication APIs) is expected before the app is considered
  production-appropriate for a financial product, given the sensitivity of the data it displays.
  This is recorded as a future requirement, not built in the current web-first scope.

## 17. Public-Product Readiness: High-Level Regulatory Considerations

These are **flagged for formal legal review before public release** — not resolved here:

### India DPDP (Digital Personal Data Protection) Act considerations
- Consent and purpose limitation: a public product must obtain clear consent for data processing and
  use data only for the purposes disclosed — the current single-user product has no third-party data
  subject, so this doesn't yet bind, but the architecture (explicit consent points, no silent secondary
  use) should already anticipate it.
- Correction and deletion rights: already partially satisfied structurally by §10–§11 above; must be
  formally reviewed against actual DPDP obligations before public launch.
- Breach handling: DPDP is expected to impose breach-notification obligations; the incident-response
  plan required in §13 for the public stage must be built with this in mind, finalised with legal input.

### SEBI Investment Adviser (IA) boundary
- The product must not provide **personalised** buy/sell recommendations or portfolio advice tied to an
  individual's specific financial situation in a way that could be construed as regulated investment
  advisory activity. Explainable, source-cited *research/insight about the user's own already-held
  data* is the intended boundary (Product Principles 3, 8); whether any specific future feature crosses
  into IA territory is a legal determination, not a product-team determination, and must be reviewed
  before that feature is built for public use.

### SEBI Research Analyst (RA) boundary
- Distributing company/market research (Phase 11 features) to the public may implicate Research Analyst
  registration requirements, depending on how the research is generated, sourced, and distributed. This
  boundary must be reviewed with counsel before any public-facing research-distribution feature ships —
  it is not a concern for single-user personal use, where the "distribution" is the user viewing their
  own requested research.

### Account Aggregator / FIU eligibility
- Participating in the AA ecosystem as a Financial Information User (FIU) has eligibility and regulatory
  requirements. This is explicitly **not assumed** for the current unregulated, personal-use product
  (§1 anchor in `07-data-source-strategy.md`) and is a Phase 15+ consideration requiring dedicated legal
  and business-structure review.

### Market-data licensing
- Any use of NSE/BSE/AMFI or third-party market data beyond personal, non-commercial reference use may
  carry licensing obligations, especially at public-product scale. Must be confirmed per source/provider
  before public release (see `07-data-source-strategy.md` and `12-research-sources.md`).

## 18. AI Data Minimisation

- When an AI provider is eventually integrated (Phase 12), only the minimum data necessary to answer
  the specific request is sent — e.g., aggregated/derived figures rather than raw full transaction
  history where an aggregate would do; no unnecessary personally identifying details.
- AI provider selection considers the provider's data-retention and training-use policies as a
  first-class input, consistent with the "replaceable AI provider" architecture decision — a provider
  that trains on submitted data by default is not acceptable for this product without an explicit,
  reviewed opt-out or a data-processing agreement.

## 19. Log Redaction

- Application/server logs must never contain full account numbers, card numbers, or the prohibited data
  categories in §2 — this applies even though those categories are never stored, as a defence against
  accidental capture (e.g., a stray debug log of a full request payload).
- Logs should avoid including full transaction descriptions/amounts at verbose log levels where
  reasonably avoidable, favouring entity IDs over raw financial content for routine operational logging.

## 20. Summary Table — Prohibited vs Required Data Handling

| Category | Stored? | Notes |
|---|---|---|
| CVV / PIN / OTP / net-banking password / UPI PIN / full card number / full mag-stripe / broker password | **Never** | Structural, permanent prohibition |
| Last-four card/account digits | Yes | Non-sensitive identifier only |
| Account balances, transactions, holdings | Yes | RLS-scoped, High sensitivity, encrypted at rest/in transit |
| API secrets / provider keys | Yes, server-side only | Never client-side, never plaintext in a DB table |
| Raw uploaded statements | Yes | Private Storage, user-deletable, does not cascade-delete resulting Transactions |
| Audit history | Yes | Append-only, never edited/deleted except formal data-deletion request |

**Formal legal/compliance review is required before any public release** covering, at minimum: DPDP
obligations, the SEBI IA/RA boundary for any research or insight feature, and AA/FIU eligibility if bank
automation is pursued. Nothing in this document should be read as a substitute for that review.
