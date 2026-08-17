# 12 — Research Sources

This document records authoritative organisations relevant to PENRA Money OS's Indian financial domain,
and the sources selected in `07-data-source-strategy.md`. Entries marked **Verified 2026-08-16** were
actually checked (via live fetch or search) during this Phase 0 session — those dates are real, not
placeholders. No fact or date below is fabricated; where something could not be confirmed in this
session, it is explicitly marked as such rather than guessed.

## 1. RBI — Reserve Bank of India

| Field | Detail |
|---|---|
| Organisation | Reserve Bank of India (India's central bank) |
| Purpose | Regulates money supply, banking, currency, and credit systems; issues monetary policy, banking regulations, and payment-system rules |
| URL | https://www.rbi.org.in |
| Status | Primary |
| Data expected | Policy rates, banking regulations/circulars/master directions, payment-system rules, financial-sector statistics |
| Update expectations | Continuous — circulars and notifications published on an ongoing basis; statistical publications on periodic (weekly/monthly/quarterly/annual) schedules |
| Licensing/usage questions | Public regulatory content; general reference use is standard, but redistribution at scale should be confirmed if ever relevant |
| Last verified | 2026-08-16 (live fetch confirmed site identity and content scope) |

## 2. SEBI — Securities and Exchange Board of India

| Field | Detail |
|---|---|
| Organisation | Securities and Exchange Board of India |
| Purpose | Regulates securities markets; protects investor interests; governs stock exchanges, brokers, mutual funds, investment advisers, and research analysts |
| URL | https://www.sebi.gov.in |
| Status | Primary |
| Data expected | Regulations governing Investment Advisers and Research Analysts (directly relevant to the IA/RA boundary in `08-security-privacy-and-compliance.md` §17); market statistics; investor-protection resources |
| Update expectations | Continuous — regulatory circulars and guidance published on an ongoing basis |
| Licensing/usage questions | Public regulatory content for reference; the IA/RA regulations themselves must be read by counsel, not summarised as legal conclusions here |
| Last verified | 2026-08-16 (live fetch confirmed site identity and content scope) |

## 3. AMFI — Association of Mutual Funds in India

| Field | Detail |
|---|---|
| Organisation | Association of Mutual Funds in India |
| Purpose | Industry body for Indian mutual funds; investor education and regulatory-compliance support |
| URL | https://www.amfiindia.com |
| Status | Primary (for NAV data specifically, per `07-data-source-strategy.md` §2.7 and the Phase 0 brief's research anchor) |
| Data expected | Daily mutual fund NAV (a "Latest NAV," "NAV Download," and "NAV History" section was confirmed present on the site) |
| Update expectations | Daily (end-of-day), per standard AMFI practice |
| Licensing/usage questions | **Not fully confirmed this session** — the site's NAV Download section was confirmed to exist, but the exact bulk-download file format (e.g., a `NAVAll.txt`-style file) and its redistribution/usage terms were not confirmed and must be checked directly against AMFI's published terms before building the Phase 9–10 AMFI import integration. Do not assume unrestricted redistribution rights. |
| Last verified | 2026-08-16 (live fetch confirmed site identity, purpose, and presence of NAV download/history features; download-format and licensing detail not confirmed) |

## 4. NSE — National Stock Exchange of India

| Field | Detail |
|---|---|
| Organisation | National Stock Exchange of India Ltd |
| Purpose | India's largest stock exchange; trading and market data across equities, derivatives, currencies, commodities, bonds, indices, and ETFs; home of the NIFTY 50 index |
| URL | https://www.nseindia.com |
| Status | Primary |
| Data expected | Equity prices, corporate announcements/filings, index levels (NIFTY 50 and others) |
| Update expectations | Real-time/intraday during market hours; end-of-day bhavcopy-style data historically available |
| Licensing/usage questions | Exchange market data typically carries licensing/redistribution terms for commercial or programmatic use — must be confirmed directly with NSE (or a licensed data vendor reselling NSE data) before any automated integration; not assumed free for that use case |
| Last verified | 2026-08-16 (confirmed via web search — direct live fetch of the site timed out twice in this session; identity and purpose corroborated by search results referencing the official nseindia.com site) |

## 5. BSE — Bombay Stock Exchange

| Field | Detail |
|---|---|
| Organisation | BSE Ltd (Bombay Stock Exchange) |
| Purpose | India's oldest stock exchange; live stock/share market data and trading platform; home of the SENSEX index |
| URL | https://www.bseindia.com |
| Status | Primary |
| Data expected | Equity prices, corporate filings/announcements, SENSEX index levels |
| Update expectations | Real-time/intraday during market hours |
| Licensing/usage questions | Same caveat as NSE — exchange data licensing for programmatic/redistribution use must be confirmed directly, not assumed |
| Last verified | 2026-08-16 (live fetch confirmed site identity and content scope) |

## 6. PFRDA — Pension Fund Regulatory and Development Authority

| Field | Detail |
|---|---|
| Organisation | Pension Fund Regulatory and Development Authority |
| Purpose | Regulates and develops the pension sector in India, including the National Pension System (NPS) and Atal Pension Yojana |
| URL | https://www.pfrda.org.in |
| Status | Primary (for any future dedicated NPS module, per `03-feature-inventory.md` §14) |
| Data expected | NPS scheme rules, subscriber/AUM statistics, regulatory circulars |
| Update expectations | Periodic (bulletins, annual reports) plus ongoing regulatory notifications |
| Licensing/usage questions | Not assessed in this session — no automated integration is planned in current MVP scope (generic manual Asset entry only, per `04-mvp-scope.md` §3) |
| Last verified | 2026-08-16 (live fetch confirmed site identity and content scope) |

## 7. EPFO — Employees' Provident Fund Organisation

| Field | Detail |
|---|---|
| Organisation | Employees' Provident Fund Organisation, Ministry of Labour & Employment |
| Purpose | Administers the Employees' Provident Fund Scheme, Employees' Pension Scheme, and Employees' Deposit Linked Insurance Scheme for the organised sector |
| URL | https://www.epfindia.gov.in |
| Status | Primary (for any future dedicated EPF module, per `03-feature-inventory.md` §13) |
| Data expected | EPF scheme rules, member account statistics, annual accounts |
| Update expectations | Periodic reporting; member-level data access is via the member portal, not a public bulk feed |
| Licensing/usage questions | Not assessed in this session — no automated integration is planned in current MVP scope; per `07-data-source-strategy.md` §1, scraping a member portal is explicitly not a valid production strategy |
| Last verified | 2026-08-16 (live fetch confirmed site identity and content scope) |

## 8. India Post

| Field | Detail |
|---|---|
| Organisation | Department of Posts, Government of India, Ministry of Communications |
| Purpose | Postal services, including administration of small savings schemes | 
| URL | https://www.indiapost.gov.in |
| Status | Secondary (relevant as a possible institutional reference for PPF/National Savings Certificate accounts held at post offices; PPF itself in MVP is tracked via manual entry regardless of issuing institution, per `06-conceptual-data-model.md` §16) |
| Data expected | General information on Post Office Savings Schemes; detailed scheme terms were not confirmed to be present on the top-level page fetched in this session |
| Update expectations | Not assessed |
| Licensing/usage questions | Not assessed — no automated integration planned |
| Last verified | 2026-08-16 (live fetch confirmed site identity and general purpose; detailed PPF/NSC scheme-page content not specifically confirmed) |

## 9. MeitY — Ministry of Electronics and Information Technology

| Field | Detail |
|---|---|
| Organisation | Ministry of Electronics and Information Technology, Government of India |
| Purpose | Administers India's digital-economy and data-protection policy, including the Digital Personal Data Protection (DPDP) Act, 2023 |
| URL | https://www.meity.gov.in |
| Status | Primary (for DPDP compliance research, per `08-security-privacy-and-compliance.md` §17) |
| Data expected | DPDP Act text, DPDP Rules, and related notifications |
| Update expectations | Event-driven, tied to rule-making activity |
| Licensing/usage questions | Public legal/regulatory text; not a licensing concern, but interpretation requires legal review, not product-team summarisation |
| Last verified | 2026-08-16 (confirmed via web search rather than direct site fetch). The search corroborated that the Digital Personal Data Protection Act, 2023 received presidential assent on 11 August 2023, and that MeitY notified the associated DPDP Rules on 13 November 2025, to come into force in a staggered approach. This is a materially useful, dated fact for `08-security-privacy-and-compliance.md` §17: **the DPDP Rules are now notified (as of this Phase 0 session), not merely pending** — the required formal legal review before public release should account for the notified Rules, not just the base Act. |

## 10. Supabase (Official Documentation)

| Field | Detail |
|---|---|
| Organisation | Supabase (backend-as-a-service platform) |
| Purpose | Official product documentation for the platform this product's backend is planned on (PostgreSQL database, Auth, Storage, Edge Functions, Realtime) |
| URL | https://supabase.com/docs |
| Status | Primary |
| Data expected | Implementation guidance for every Supabase capability referenced in `09-architecture-decisions.md` (ADR-01–06) |
| Update expectations | Continuously maintained by Supabase as their product evolves |
| Licensing/usage questions | None beyond standard platform terms of service |
| Last verified | 2026-08-16 (live fetch confirmed the documentation covers PostgreSQL database, Auth including email/password/passwordless/OAuth, Storage with RLS-integrated access policies, and Edge Functions) |

## 11. Official Broker Developer Documentation

| Field | Detail |
|---|---|
| Organisation | Not applicable — no specific broker has been selected or contracted |
| Purpose | Would provide holdings/price-sync API access for a future broker integration (`03-feature-inventory.md` §8, §29) |
| URL | Not applicable |
| Status | Secondary / future |
| Data expected | Broker-specific — to be determined when a specific broker partnership is pursued |
| Update expectations | Not applicable yet |
| Licensing/usage questions | Not applicable yet — broker API terms vary significantly and must be reviewed per broker at integration time |
| Last verified | Not applicable — no source exists to verify yet |

## 12. Verification Notes

- All "Last verified" dates above reflect checks actually performed during this Phase 0 authoring
  session (2026-08-16), using either a live page fetch or a web search that corroborated the site's
  identity and purpose. Where a specific technical detail (e.g., AMFI's exact bulk-download file format)
  was not confirmed, that is stated explicitly rather than assumed.
- These verifications confirm **organisational identity and general purpose/content scope only** — they
  do not constitute confirmation of specific API endpoints, data licensing terms, or redistribution
  rights, all of which must be separately confirmed at the point of actual integration (Phases 8–12).
- No verification was possible or attempted for entries marked "Not applicable" (§11), since no specific
  vendor exists yet to verify against.
