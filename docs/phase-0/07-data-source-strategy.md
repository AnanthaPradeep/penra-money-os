# 07 — Data Source Strategy

This document defines, per data category, how PENRA Money OS acquires data today (MVP) and how it is
expected to evolve later — always through a **replaceable provider-adapter** pattern, never a hard
dependency on one vendor (Product Principle 9). No external API is connected in Phase 0; this is a
strategy document, not an integration.

## 1. Research Anchors

These statements anchor every source decision below and must not be contradicted elsewhere in this
document set:

- **AMFI** (Association of Mutual Funds in India) can be used as an official NAV source for mutual
  funds.
- **NSE, BSE, and SEBI filings** are primary sources for company information (prices, corporate actions,
  disclosures).
- **Broker APIs** may later provide holdings and market data, once a specific broker partnership/API
  access exists — none is assumed or integrated in Phase 0 or the MVP.
- **Direct Account Aggregator (AA) participation is not assumed** for an unregulated, single-user,
  non-commercial product. AA integration is a future, public-product-stage consideration requiring FIU
  eligibility and legal review (see `08-security-privacy-and-compliance.md`).
- **The MVP uses manual entry and statement imports before any bank automation.** Automated bank/broker
  connectivity is explicitly sequenced after the manual/import foundation is proven, not built in
  parallel with it.
- **Public or undocumented website scraping must not be treated as a production data strategy** — not
  for bank data, not for market data, not for company research. Any data source that isn't an official
  API, an official bulk data file (e.g., AMFI's published NAV file), or a licensed provider is not a
  production-viable source, regardless of how convenient it looks during prototyping.

## 2. Source Strategy by Data Category

### 2.1 Manual Data (all categories)

| Aspect | Detail |
|---|---|
| MVP method | Direct user entry via the application UI for every data category in MVP scope. |
| Future method | Remains available permanently, even after automation exists — manual entry/override is a standing user right (Product Principle 4), not a stopgap. |
| Official/third-party | N/A — user-originated. |
| Update frequency | On demand, whenever the user enters or edits data. |
| Licensing concern | None. |
| Reliability concern | Human error (typos, missed entries); mitigated by audit history and the ability to correct without penalty. |
| Fallback behaviour | N/A — this is itself the fallback for every other source. |
| Required timestamp | Yes — every manual entry carries the date it represents (effective date), distinct from when it was typed in. |
| Manually correctable | Yes, by definition. |

### 2.2 CSV Imports (bank/card statements)

| Aspect | Detail |
|---|---|
| MVP method | User uploads a CSV exported from their bank/card issuer's net-banking portal; a column-mapping step lets the user (or a saved per-institution mapping) align columns to Transaction fields. |
| Future method | Saved, reusable per-institution import mappings; broader format auto-detection. |
| Official/third-party | Third-party in the sense that format varies per bank; the data itself originates from the user's own bank. |
| Update frequency | On demand, whenever the user imports a new statement period. |
| Licensing concern | None (the user's own data, exported by the user). |
| Reliability concern | Inconsistent CSV formats across banks; ambiguous date formats; encoding issues. Mitigated by explicit column mapping and duplicate detection at import time. |
| Fallback behaviour | If a row fails to parse, it is flagged for manual review/entry rather than silently skipped. |
| Required timestamp | Yes — transaction date per row, plus the Import Batch's own imported_at timestamp. |
| Manually correctable | Yes — every imported Transaction is editable like any manually entered one, without losing its Import Batch provenance. |

### 2.3 PDF Statement Imports

| Aspect | Detail |
|---|---|
| MVP method | Not in MVP — user manually transcribes key figures (or exports CSV instead) where a bank doesn't offer CSV export. |
| Future method | PDF text/table extraction into the same Import Batch pipeline as CSV, with the same review-before-commit flow. |
| Official/third-party | Third-party format variance, same as CSV; data originates from the user's own bank/card issuer. |
| Update frequency | On demand. |
| Licensing concern | None. |
| Reliability concern | PDF layout variance is higher-risk than CSV for misparsing; requires stronger review-before-commit UX than CSV. |
| Fallback behaviour | Failed extraction falls back to manual entry, never a silent partial import. |
| Required timestamp | Yes, same as CSV. |
| Manually correctable | Yes. |

### 2.4 Bank Transaction Automation (direct feed)

| Aspect | Detail |
|---|---|
| MVP method | None — explicitly out of scope (§ non-goals, `04-mvp-scope.md`). |
| Future method | Only via a regulated Account Aggregator (AA) integration, requiring FIU eligibility/partnership and legal review — never direct bank login or scraping, under any circumstance. |
| Official/third-party | Would be official only via the RBI-regulated AA framework. |
| Update frequency | N/A until built. |
| Licensing concern | Regulatory eligibility (FIU registration or partnership with a regulated TSP) required before this can exist at all. |
| Reliability concern | N/A until built. |
| Fallback behaviour | Manual entry/CSV import remains available permanently, even after this exists. |
| Required timestamp | Would be, per transaction, same as CSV. |
| Manually correctable | Would remain yes — automation never removes the user's correction right. |

### 2.5 Broker Holdings

| Aspect | Detail |
|---|---|
| MVP method | Manual entry of buy/sell/contribution Investment Transactions. |
| Future method | A specific broker's official API, integrated as a provider adapter, once a partnership/API access exists. |
| Official/third-party | Would be official (the broker's own API) once integrated. |
| Update frequency | MVP: on demand. Future: daily or real-time, depending on the broker API's own cadence. |
| Licensing concern | Broker API terms of use; no assumption of free/open access. |
| Reliability concern | Broker API availability/rate limits; mitigated by manual entry always remaining available as a fallback and correction path. |
| Fallback behaviour | Falls back to the last successfully synced Holding Snapshot plus a manual-override path. |
| Required timestamp | Yes — every Investment Transaction and resulting Holding Snapshot is dated. |
| Manually correctable | Yes, always. |

### 2.6 Stock Prices

| Aspect | Detail |
|---|---|
| MVP method | Manual entry of a Market Price per instrument, as needed. |
| Future method | A licensed market-data provider adapter (NSE/BSE-sourced or a licensed aggregator), never unlicensed scraping. |
| Official/third-party | NSE/BSE are the primary official sources; a licensed data vendor may be used as a distribution intermediary. |
| Update frequency | MVP: on demand (manual). Future: end-of-day at minimum; intraday only if a licensed feed supports it and the product needs it (not assumed as a requirement). |
| Licensing concern | Real-time and even delayed exchange data typically carries licensing/redistribution terms — must be verified with the specific provider before integration, not assumed free. |
| Reliability concern | Feed downtime, symbol-mapping errors (ISIN/exchange symbol mismatches). |
| Fallback behaviour | Falls back to the last known Market Price, with staleness clearly indicated per `05-domain-glossary-and-rules.md` §12. |
| Required timestamp | Yes, mandatory on every Market Price row. |
| Manually correctable | Yes — a manual entry overrides a provider value for the same date. |

### 2.7 Mutual Fund NAV

| Aspect | Detail |
|---|---|
| MVP method | Manual entry of NAV per scheme, as needed. |
| Future method | Scheduled import of AMFI's official published NAV file (a public, official, bulk-download data source). |
| Official/third-party | Official — AMFI is the industry body publishing daily NAVs for all Indian mutual fund schemes. |
| Update frequency | AMFI publishes NAV once daily (end-of-day); a future scheduled job would align to that cadence. |
| Licensing concern | AMFI's public NAV data is intended for general reference use; exact redistribution terms should be confirmed at integration time (not fabricated here — see `12-research-sources.md`). |
| Reliability concern | Occasional publishing delays; scheme-code mapping errors. |
| Fallback behaviour | Falls back to last known NAV, staleness indicated. |
| Required timestamp | Yes, mandatory. |
| Manually correctable | Yes. |

### 2.8 Company Fundamentals

| Aspect | Detail |
|---|---|
| MVP method | Not in MVP. |
| Future method | NSE/BSE published data and/or a licensed financial-data provider adapter, for Phase 11 (Company research). |
| Official/third-party | NSE/BSE are primary; a licensed aggregator may be used for convenience with clear sourcing shown to the user. |
| Update frequency | Aligned to filing/reporting cadence (quarterly results, corporate actions as they occur). |
| Licensing concern | Must be verified per provider; not assumed free. |
| Reliability concern | Data-vendor normalisation errors; mitigated by always showing the original source (Research Source entity). |
| Fallback behaviour | If unavailable, the feature simply shows no data rather than a stale or fabricated figure. |
| Required timestamp | Yes — every fundamental figure shown carries its "as of" reporting date. |
| Manually correctable | Not applicable in the same sense as personal data — the user can flag it as wrong, but this is third-party public data, not user-owned data to silently override. |

### 2.9 Corporate Filings

| Aspect | Detail |
|---|---|
| MVP method | Not in MVP. |
| Future method | SEBI/NSE/BSE filing feeds (official disclosure sources), for Phase 11. |
| Official/third-party | Official (SEBI/exchange disclosure systems). |
| Update frequency | Event-driven, as filings are published. |
| Licensing concern | Public disclosures are generally freely accessible for reference; any AI-generated summarisation must retain a link to the original filing (Research Source). |
| Reliability concern | Volume and format variance across filings; summarisation accuracy risk, mitigated by explainability requirements. |
| Fallback behaviour | If a filing can't be parsed/summarised, the raw filing link is still shown. |
| Required timestamp | Yes — filing date. |
| Manually correctable | N/A (third-party official record); user can flag a summarisation error. |

### 2.10 PPF, FD, and RD Information

| Aspect | Detail |
|---|---|
| MVP method | Manual entry of account terms and contributions/interest, sourced from the user's own passbook/certificate. |
| Future method | Remains manual — these are non-API institutional products in India for a retail personal-finance product; no scraping of net-banking portals is considered, per §1 anchors. |
| Official/third-party | The user's own bank/post-office record. |
| Update frequency | On demand, aligned to when the user updates their passbook/certificate. |
| Licensing concern | None. |
| Reliability concern | Manual transcription error; mitigated by audit history. |
| Fallback behaviour | N/A. |
| Required timestamp | Yes — contribution/interest dates, maturity date. |
| Manually correctable | Yes. |

### 2.11 EPF and NPS

| Aspect | Detail |
|---|---|
| MVP method | Generic manual Asset entry (current balance + date) only, per `04-mvp-scope.md` §3. |
| Future method | A dedicated module could integrate EPFO/NPS-CRA member portals if and when an official API or data-sharing mechanism exists; scraping the member portal is explicitly not considered a valid production strategy per §1 anchors. |
| Official/third-party | EPFO / NPS Trust (PFRDA-regulated) are the official sources. |
| Update frequency | MVP: on demand. |
| Licensing concern | Unknown/unconfirmed until a specific official API is identified — do not assume one exists. |
| Reliability concern | Manual entry only in MVP; no automation reliability concern yet. |
| Fallback behaviour | N/A. |
| Required timestamp | Yes. |
| Manually correctable | Yes. |

### 2.12 Market Indices

| Aspect | Detail |
|---|---|
| MVP method | Not in MVP. |
| Future method | A licensed market-data provider adapter for Nifty/Sensex-level data, Phase 11. |
| Official/third-party | NSE (Nifty)/BSE (Sensex) are official; typically accessed via a licensed data vendor for programmatic use. |
| Update frequency | End-of-day at minimum. |
| Licensing concern | Must be verified per provider. |
| Reliability concern | Feed downtime. |
| Fallback behaviour | Last known value shown with staleness indicated. |
| Required timestamp | Yes. |
| Manually correctable | N/A (public reference data). |

### 2.13 Financial News

| Aspect | Detail |
|---|---|
| MVP method | Not in MVP. |
| Future method | A licensed news-provider adapter, Phase 11, always shown with a link/citation to the original publisher. |
| Official/third-party | Third-party publishers; must be appropriately licensed for redistribution/display. |
| Update frequency | Real-time to daily, depending on provider. |
| Licensing concern | News redistribution licensing is a real, non-trivial concern — must be confirmed per provider, not assumed. |
| Reliability concern | Source credibility varies; mitigated by always surfacing the publisher and date. |
| Fallback behaviour | If unavailable, feature simply shows nothing. |
| Required timestamp | Yes — publish date. |
| Manually correctable | N/A. |

### 2.14 AI Research Sources / AI Provider

| Aspect | Detail |
|---|---|
| MVP method | Not in MVP. |
| Future method | A replaceable AI-provider adapter (Product Principle 9 / architecture decision in `09-architecture-decisions.md`), used only to generate explainable, source-cited insight — never to autonomously act on the user's data. |
| Official/third-party | Third-party AI provider(s); kept swappable so the product is never structurally dependent on one vendor. |
| Update frequency | On demand, per user request or scheduled insight generation. |
| Licensing concern | AI provider terms of use, especially around data retention/training use of the user's financial data — must be reviewed per provider before integration (see `08-security-privacy-and-compliance.md` data-minimisation requirements). |
| Reliability concern | Model output accuracy/hallucination risk — mitigated structurally by requiring every AI insight to cite the source data/Research Source it was derived from (Product Principle 3), never presented as an unsourced claim. |
| Fallback behaviour | If the AI provider is unavailable, the feature degrades to showing raw underlying data without AI commentary, rather than blocking access to the user's own data. |
| Required timestamp | Yes — generation timestamp on every AI-produced insight. |
| Manually correctable | The user can dismiss/flag an insight as incorrect; underlying source data itself remains independently correctable per its own category above. |

## 3. Provider Abstraction Principle

Every category above that has a "Future method" involving an external vendor must be implemented (when
that phase arrives) behind a **provider-adapter interface** internal to the product — the rest of the
system depends on the adapter's contract (e.g., "get latest NAV for scheme X as of date Y"), never on a
specific vendor's SDK or response shape directly. This is what makes "replaceable AI provider" and
"replaceable financial-data providers" true in practice, not just in principle. See
`09-architecture-decisions.md` for the corresponding architecture decision record.
