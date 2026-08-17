# 03 — Feature Inventory

This inventory captures the **full long-term feature surface** of PENRA Money OS, grouped by domain
area. It intentionally includes far more than the MVP — the personal MVP subset is defined precisely in
`04-mvp-scope.md` and must match the "MVP" column below exactly. Roadmap phase numbers reference
`10-product-roadmap.md`.

**Column legend**

- **Priority**: Must / Should / Could / Won't (MoSCoW, for the *overall product*, not just MVP)
- **Phase**: earliest roadmap phase the feature is planned for (see `10-product-roadmap.md`); "Unphased"
  means it is acknowledged but not yet assigned to a specific phase (tracked in
  `11-open-decisions-and-risks.md`)
- **Data Sensitivity**: Low / Medium / High / Critical
- **Automation Level**: Manual / Semi-Automated / Automated
- **Regulatory Risk**: None / Low / Medium / High
- **MVP**: Yes / No / Partial (Partial = a generic, lightweight version is in MVP; a dedicated module is
  not)

## 1. Accounts

| Feature | Description | User Value | Priority | Phase | Dependencies | Data Sensitivity | Automation | Reg. Risk | MVP |
|---|---|---|---|---|---|---|---|---|---|
| Bank accounts | Track savings/current bank accounts with manual opening balance and running balance | Single source of truth for bank balances | Must | 3 | — | High | Manual | Low | Yes |
| Cash accounts | Track physical cash on hand | Complete picture including offline cash | Must | 3 | — | Low | Manual | None | Yes |
| Wallet accounts | Track UPI/digital wallet balances | Covers common Indian payment behaviour | Must | 3 | — | Medium | Manual | Low | Yes |
| Credit card accounts | Track a card as an account with limit, dues, statement cycle | Central place for card obligations | Must | 3 | — | High | Manual | Low | Yes |
| Basic loan/liability accounts | Track a personal loan/EMI as an account with balance | Net worth includes debts, not just assets | Must | 3 | — | High | Manual | Low | Yes |
| Account status (active/closed/frozen) | Mark accounts active, closed, or frozen | Keeps history without cluttering active views | Should | 3 | Accounts | Low | Manual | None | Yes |
| Last-four-digit identifiers | Store only last 4 digits of card/account number for recognition | Safe identification without storing sensitive numbers | Must | 3 | Accounts | Medium | Manual | Low | Yes |
| Multi-institution linking (broker, AMC, EPFO, NPS-CRA) | Associate accounts with an institution entity | Cleaner grouping/reporting by institution | Should | 3 | Institution entity | Low | Manual | None | Yes |
| Bank-linked automatic account sync | Auto-sync balances via Account Aggregator or bank API | Removes manual balance upkeep | Could | Unphased (post-15) | AA/FIU eligibility, broker/bank partnerships | Critical | Automated | High | No |

## 2. Transactions

| Feature | Description | User Value | Priority | Phase | Dependencies | Data Sensitivity | Automation | Reg. Risk | MVP |
|---|---|---|---|---|---|---|---|---|---|
| Manual transaction entry | Add income/expense/transfer manually | Baseline data entry | Must | 3 | Accounts | High | Manual | None | Yes |
| Income transactions | Record salary and other income | Understand cash inflow | Must | 3 | Transactions | High | Manual | None | Yes |
| Expense transactions | Record spending | Understand cash outflow | Must | 3 | Transactions | High | Manual | None | Yes |
| Transfer transactions | Move money between the user's own accounts, excluded from income/expense | Accurate cash-flow reporting | Must | 3 | ≥2 accounts | High | Manual | None | Yes |
| Refunds | Record money returned for a prior expense | Accurate net spending | Must | 3 | Transactions | Medium | Manual | None | Yes |
| Reimbursements | Record money received back (e.g., from employer) for a prior expense | Accurate net spending | Must | 3 | Transactions | Medium | Manual | None | Yes |
| Fees | Record bank/card/service fees distinctly | Visibility into fee drag | Should | 3 | Transactions | Medium | Manual | None | Yes |
| Interest (earned) | Record interest credited (savings, FD, RD) | Accurate income picture | Should | 3 | Transactions | Medium | Manual | None | Yes |
| Dividends | Record dividend income from stocks/MFs | Accurate income picture | Should | 8 | Investment holdings | Medium | Manual | None | Yes |
| Editing with audit history | Edit any transaction; every change is logged (before/after, who, when) | Trust — no silent changes | Must | 4 | Audit Event entity | High | Manual | None | Yes |
| CSV import | Import transactions from a bank/card CSV export | Removes re-typing months of history | Must | 4 | Import Batch entity | High | Semi-Automated | Low | Yes |
| PDF statement import | Parse transactions from a PDF bank/card statement | Covers banks that don't export CSV | Should | 4 | CSV import, PDF parsing | High | Semi-Automated | Low | No (Should, post-MVP) |
| Duplicate detection | Flag likely-duplicate transactions on import | Prevents double-counting | Must | 4 | CSV import | Medium | Semi-Automated | None | Yes |
| Categorisation (manual + suggested) | Assign a category to each transaction, with suggestions | Enables reporting by category | Must | 4 | Categories | Medium | Semi-Automated | None | Yes |
| Tags and notes | Free-form tags/notes on a transaction | Personal context and flexible filtering | Should | 4 | Transactions | Low | Manual | None | Yes |
| Search and filters | Search/filter transactions by date, account, category, tag, amount | Find any transaction quickly | Must | 4 | Transactions | Low | Manual | None | Yes |
| Split transactions (one transaction, multiple categories) | Divide a single transaction across categories | Accurate categorisation for mixed purchases | Could | Unphased | Transactions | Medium | Manual | None | No |
| Bank-automated transaction feed | Transactions arrive automatically via AA/bank API | Removes import step entirely | Could | Unphased (post-15) | AA/FIU eligibility | Critical | Automated | High | No |

## 3. Expenses

| Feature | Description | User Value | Priority | Phase | Dependencies | Data Sensitivity | Automation | Reg. Risk | MVP |
|---|---|---|---|---|---|---|---|---|---|
| Categories and subcategories | Hierarchical expense categories | Structured, drillable reporting | Must | 3 | — | Low | Manual | None | Yes |
| Monthly budgets | Set a spend limit per category per month | Behaviour-changing feedback loop | Must | 5 | Categories, Transactions | Medium | Manual | None | Yes |
| Monthly reports | Spend summary for a given month | Understand recent spending | Must | 5 | Transactions | Medium | Automated (computed) | None | Yes |
| Annual reports (FY-aligned) | Spend summary for an Indian financial year (Apr–Mar) | Year-level view aligned to Indian FY | Must | 5 | Transactions | Medium | Automated (computed) | None | Yes |
| Merchant tracking | Group transactions by merchant/payee | See where money concentrates | Should | 4 | Transactions | Medium | Semi-Automated | None | Yes |
| Recurring-expense detection | Detect repeating expenses (e.g., monthly rent, bills) | Surfaces obligations automatically | Should | 5 | Transactions | Medium | Semi-Automated | None | Yes |
| Unusual-expense flags | Flag transactions that deviate from historical pattern | Catch errors/fraud/overspend early | Should | 5 | Transactions, history | Medium | Semi-Automated | None | Yes |
| Savings-rate calculation | (Income − Expense) / Income over a period | Single trend metric for financial health | Must | 5 | Income, Expense | Medium | Automated (computed) | None | Yes |
| Envelope/zero-based budgeting mode | Alternative budgeting methodology | Serves a different budgeting preference | Could | Unphased | Budgets | Medium | Manual | None | No |

## 4. Income

| Feature | Description | User Value | Priority | Phase | Dependencies | Data Sensitivity | Automation | Reg. Risk | MVP |
|---|---|---|---|---|---|---|---|---|---|
| Income recording | Salary and other income entries | Understand inflow | Must | 3 | Transactions | High | Manual | None | Yes |
| Income categorisation (salary, freelance, interest, dividend, other) | Classify income by source type | Understand income composition | Should | 5 | Income | Low | Manual | None | Yes |
| Multiple income streams | Track more than one recurring income source | Reflects real freelance/side-income situations | Should | 5 | Income | Medium | Manual | None | Yes |
| Income trend reporting | Income over time, by source | Understand income stability/growth | Should | 5 | Income | Low | Automated (computed) | None | Yes |

## 5. Budgets

(See also §3 Expenses for budget-adjacent features.)

| Feature | Description | User Value | Priority | Phase | Dependencies | Data Sensitivity | Automation | Reg. Risk | MVP |
|---|---|---|---|---|---|---|---|---|---|
| Category budgets | Monthly limit per category | Core budgeting loop | Must | 5 | Categories | Medium | Manual | None | Yes |
| Budget vs actual view | Compare budgeted vs spent | Immediate feedback | Must | 5 | Budgets, Transactions | Medium | Automated (computed) | None | Yes |
| Rollover budgets | Unused budget carries to next month | Flexible budgeting style | Could | Unphased | Budgets | Medium | Manual | None | No |
| Budget alerts | Notify when nearing/exceeding a budget | Proactive behaviour change | Should | 10 | Budgets, Alerts | Medium | Semi-Automated | None | Yes |

## 6. Credit Cards

| Feature | Description | User Value | Priority | Phase | Dependencies | Data Sensitivity | Automation | Reg. Risk | MVP |
|---|---|---|---|---|---|---|---|---|---|
| Credit limit tracking | Store the card's credit limit | Basis for utilisation | Must | 3 | Credit card account | High | Manual | None | Yes |
| Statement date | Store the monthly statement date | Know the billing cycle | Must | 3 | Credit card account | Medium | Manual | None | Yes |
| Payment due date | Store the due date | Avoid late fees | Must | 3 | Credit card account | Medium | Manual | None | Yes |
| Total amount due | Store total due from the statement | Know full obligation | Must | 3 | Credit card account | High | Manual | None | Yes |
| Minimum amount due | Store minimum due from the statement | Know the floor payment | Must | 3 | Credit card account | High | Manual | None | Yes |
| Available credit | Limit minus outstanding balance | Know spending headroom | Must | 3 | Credit limit, balance | Medium | Automated (computed) | None | Yes |
| Credit utilisation | Outstanding balance ÷ limit | Understand credit health signal | Must | 3 | Credit limit, balance | Medium | Automated (computed) | None | Yes |
| Annual fee reminder | Remind before an annual fee is charged | Avoid surprise charges | Should | 10 | Credit card account, Alerts | Low | Semi-Automated | None | Yes |
| EMI tracking on card | Track card-based EMI conversions | Understand committed future outflow | Should | 3 | Credit card account | Medium | Manual | None | Yes |
| Card metadata (name, issuer, last 4 digits) only | No CVV/PIN/full number ever stored | Safety by design | Must | 3 | Credit card account | High | Manual | None | Yes |
| Card rewards/cashback tracking | Track points/cashback earned | Understand card value | Could | Unphased | Credit card account | Low | Manual | None | No |

## 7. Subscriptions

| Feature | Description | User Value | Priority | Phase | Dependencies | Data Sensitivity | Automation | Reg. Risk | MVP |
|---|---|---|---|---|---|---|---|---|---|
| Service name/amount/frequency | Core subscription record | Track recurring commitments | Must | 5 | Payment account | Low | Manual | None | Yes |
| Next renewal date | Know when the next charge happens | Avoid surprise renewals | Must | 5 | Subscription | Low | Manual/Computed | None | Yes |
| Trial expiry tracking | Know when a free trial converts to paid | Avoid accidental paid conversion | Should | 5 | Subscription | Low | Manual | None | Yes |
| Payment account link | Which account/card pays for it | Understand impact per account | Should | 5 | Subscription, Account | Low | Manual | None | Yes |
| Status (active/paused/cancelled) | Lifecycle state of a subscription | Keep an accurate active list | Must | 5 | Subscription | Low | Manual | None | Yes |
| Monthly/annual subscription cost | Aggregate subscription spend | Understand total recurring burden | Must | 5 | Subscriptions | Low | Automated (computed) | None | Yes |
| Renewal reminders | Notify ahead of renewal/trial-end | Time to cancel if unwanted | Should | 10 | Subscription, Alerts | Low | Semi-Automated | None | Yes |
| Auto-detection of subscriptions from transactions | Infer subscriptions from recurring transaction patterns | Reduces manual setup | Could | Unphased | Recurring-expense detection | Medium | Semi-Automated | None | No |

## 8. Stocks (Indian Equities)

| Feature | Description | User Value | Priority | Phase | Dependencies | Data Sensitivity | Automation | Reg. Risk | MVP |
|---|---|---|---|---|---|---|---|---|---|
| Manual buy/sell entry | Record equity buy/sell transactions | Foundation of holdings | Must | 8 | Instrument, Investment Transaction | High | Manual | None | Yes |
| Quantity and average cost | Track units held and weighted average cost | Know cost basis | Must | 8 | Investment Transaction | High | Automated (computed) | None | Yes |
| Invested amount | Total capital deployed | Understand capital at work | Must | 8 | Investment Transaction | High | Automated (computed) | None | Yes |
| Current value | Quantity × latest market price | Know present worth | Must | 8 | Market Price | High | Automated (computed) | None | Yes |
| Realised gain/loss | Gain/loss on sold units | Understand booked performance | Must | 8 | Investment Transaction | High | Automated (computed) | None | Yes |
| Unrealised gain/loss | Gain/loss on held units | Understand paper performance | Must | 8 | Investment Transaction, Market Price | High | Automated (computed) | None | Yes |
| XIRR | Time-weighted annualised return across irregular cash flows | True performance metric | Should | 8 | Investment Transaction history | High | Automated (computed) | None | Yes |
| Manual price entry (fallback) | Manually enter/override a price when no feed available | Keeps values current without a live feed | Must | 8 | Instrument | Medium | Manual | None | Yes |
| Automated price feed (NSE/BSE via provider) | Auto-fetch daily/live prices | Removes manual price upkeep | Should | Unphased (post-9, provider-dependent) | Market-data provider adapter | Medium | Automated | Low | No |
| Broker holdings auto-import | Pull holdings directly from a broker API | Removes manual entry entirely | Could | Unphased (post-15) | Broker API partnership | High | Automated | Medium | No |

## 9. Mutual Funds

| Feature | Description | User Value | Priority | Phase | Dependencies | Data Sensitivity | Automation | Reg. Risk | MVP |
|---|---|---|---|---|---|---|---|---|---|
| Manual purchase/redemption entry (lump sum + SIP) | Record MF transactions | Foundation of holdings | Must | 8 | Instrument, Investment Transaction | High | Manual | None | Yes |
| Units and average NAV cost | Track units held and cost basis | Know cost basis | Must | 8 | Investment Transaction | High | Automated (computed) | None | Yes |
| Current value via NAV | Units × latest NAV | Know present worth | Must | 8 | Mutual Fund NAV | High | Automated (computed) | None | Yes |
| Realised/unrealised gain/loss | As with stocks | Understand performance | Must | 8 | Investment Transaction, NAV | High | Automated (computed) | None | Yes |
| XIRR (SIP-aware) | Annualised return across many small SIP cash flows | Correct SIP performance metric | Should | 8 | Investment Transaction history | High | Automated (computed) | None | Yes |
| AMFI NAV import (manual trigger or scheduled) | Pull official daily NAV from AMFI | Authoritative, low-cost NAV source | Should | 9–10 | AMFI data source adapter | Medium | Semi-Automated | Low | Partial (manual entry in MVP; scheduled import later) |
| Fund category/asset-allocation tagging | Classify a fund (equity/debt/hybrid, etc.) | Enables allocation reporting | Should | 8 | Instrument | Low | Manual | None | Yes |

## 10. PPF (Public Provident Fund)

| Feature | Description | User Value | Priority | Phase | Dependencies | Data Sensitivity | Automation | Reg. Risk | MVP |
|---|---|---|---|---|---|---|---|---|---|
| Account tracking (balance, opening year) | Track a PPF account as a fixed-income account | Central record of PPF | Must | 9 | Fixed-Income Account | High | Manual | None | Yes |
| Contribution entries | Record deposits into PPF | Track invested amount | Must | 9 | Fixed-Income Account | High | Manual | None | Yes |
| Interest crediting entries | Record annual interest credited | Accurate balance growth | Should | 9 | Fixed-Income Account | Medium | Manual | None | Yes |
| Maturity date and projected maturity value | 15-year maturity tracking with projected value (clearly labelled as a projection) | Long-term planning | Should | 9 | Fixed-Income Account | Medium | Automated (computed, projection) | None | Yes |
| Extension-block tracking (post-maturity 5-year blocks) | Track PPF extension elections | Correct long-term record | Could | Unphased | PPF account | Medium | Manual | None | No |

## 11. Fixed Deposits (FD)

| Feature | Description | User Value | Priority | Phase | Dependencies | Data Sensitivity | Automation | Reg. Risk | MVP |
|---|---|---|---|---|---|---|---|---|---|
| FD account tracking | Principal, rate, tenure, start/maturity date | Central FD record | Must | 9 | Fixed-Income Account | High | Manual | None | Yes |
| Maturity value | Manual entry or projected via compound-interest formula (labelled as projection, not guaranteed) | Plan around maturity | Must | 9 | FD account | Medium | Manual/Computed | None | Yes |
| Maturity reminders | Notify ahead of maturity date | Avoid missed renewal decisions | Should | 10 | FD account, Alerts | Low | Semi-Automated | None | Yes |
| Auto-renewal tracking | Track whether an FD is set to auto-renew | Accurate future-state modelling | Could | Unphased | FD account | Low | Manual | None | No |

## 12. Recurring Deposits (RD)

| Feature | Description | User Value | Priority | Phase | Dependencies | Data Sensitivity | Automation | Reg. Risk | MVP |
|---|---|---|---|---|---|---|---|---|---|
| RD account tracking | Monthly instalment, rate, tenure | Central RD record | Must | 9 | Fixed-Income Account | High | Manual | None | Yes |
| Instalment contribution entries | Record each monthly deposit | Track invested amount over time | Must | 9 | Fixed-Income Account | Medium | Manual | None | Yes |
| Maturity value | Manual entry or projected via RD future-value formula (labelled as projection) | Plan around maturity | Must | 9 | RD account | Medium | Manual/Computed | None | Yes |
| Missed-instalment tracking | Flag a month with no instalment recorded | Awareness of a lapsed RD | Could | Unphased | RD account | Low | Semi-Automated | None | No |

## 13. EPF (Employees' Provident Fund)

| Feature | Description | User Value | Priority | Phase | Dependencies | Data Sensitivity | Automation | Reg. Risk | MVP |
|---|---|---|---|---|---|---|---|---|---|
| Generic manual asset entry (current balance + date) | Enter EPF balance as a generic manual Asset for net worth | Included in net worth without a dedicated module | Should | 6 | Asset entity | High | Manual | None | Partial (generic asset entry only) |
| Dedicated EPF module (employee/employer contributions, interest, UAN linkage) | Full contribution-level EPF tracking | Detailed EPF picture | Could | Unphased | EPFO data source | High | Manual/Semi-Automated | Low | No |

## 14. NPS (National Pension System)

| Feature | Description | User Value | Priority | Phase | Dependencies | Data Sensitivity | Automation | Reg. Risk | MVP |
|---|---|---|---|---|---|---|---|---|---|
| Generic manual asset entry (current balance + date) | Enter NPS balance as a generic manual Asset | Included in net worth without a dedicated module | Should | 6 | Asset entity | High | Manual | None | Partial (generic asset entry only) |
| Dedicated NPS module (Tier I/II, asset allocation, contributions) | Full contribution-level NPS tracking | Detailed NPS picture | Could | Unphased | NPS-CRA data source | High | Manual/Semi-Automated | Low | No |

## 15. Bonds

| Feature | Description | User Value | Priority | Phase | Dependencies | Data Sensitivity | Automation | Reg. Risk | MVP |
|---|---|---|---|---|---|---|---|---|---|
| Generic manual asset entry (current value + date) | Enter a bond holding as a generic manual Asset | Included in net worth without a dedicated module | Could | 6 | Asset entity | Medium | Manual | None | Partial (generic asset entry only) |
| Dedicated bond module (coupon, maturity, YTM) | Full bond-level tracking | Detailed fixed-income picture | Could | Unphased | Instrument, Market Price | Medium | Manual | Low | No |

## 16. Gold

| Feature | Description | User Value | Priority | Phase | Dependencies | Data Sensitivity | Automation | Reg. Risk | MVP |
|---|---|---|---|---|---|---|---|---|---|
| Generic manual asset entry (current value + date) | Enter gold holdings (jewellery, coins, digital gold) as a generic manual Asset | Included in net worth without a dedicated module | Should | 6 | Asset entity | Medium | Manual | None | Partial (generic asset entry only) |
| Dedicated gold module (grams, purity, purchase lots, live price) | Weight/purity-level tracking with live gold price | Precise gold portfolio tracking | Could | Unphased | Market-data provider (gold price) | Medium | Manual/Semi-Automated | None | No |

## 17. Property (Real Estate)

| Feature | Description | User Value | Priority | Phase | Dependencies | Data Sensitivity | Automation | Reg. Risk | MVP |
|---|---|---|---|---|---|---|---|---|---|
| Generic manual asset entry (current value + date) | Enter a property's estimated value as a generic manual Asset | Included in net worth without a dedicated module | Should | 6 | Asset entity | High | Manual | None | Partial (generic asset entry only) |
| Dedicated property module (purchase cost, registration, linked home loan, rental income) | Full property record with linked liability and income | Complete real-estate picture | Could | Unphased | Asset, Liability, Income | High | Manual | None | No |

## 18. Insurance

| Feature | Description | User Value | Priority | Phase | Dependencies | Data Sensitivity | Automation | Reg. Risk | MVP |
|---|---|---|---|---|---|---|---|---|---|
| Generic manual asset entry (cash/surrender value, if any, + date) | Enter an investment-linked policy's cash value as a generic manual Asset | Included in net worth without a dedicated module | Could | 6 | Asset entity | High | Manual | None | Partial (generic asset entry only, investment-linked policies only) |
| Dedicated insurance module (policy type, sum assured, premium due dates, nominee) | Full policy record-keeping | Complete insurance picture and premium reminders | Could | Unphased | Document storage, Alerts | High | Manual | Low | No |

## 19. Loans (Liabilities)

| Feature | Description | User Value | Priority | Phase | Dependencies | Data Sensitivity | Automation | Reg. Risk | MVP |
|---|---|---|---|---|---|---|---|---|---|
| Basic loan/liability account | Track principal, rate, EMI, outstanding balance | Net worth includes debt | Must | 3 | Account | High | Manual | None | Yes |
| EMI schedule tracking | Track EMI due dates and amounts | Avoid missed EMI payments | Should | 3 | Loan account | Medium | Manual | None | Yes |
| Generic manual liability entry (informal debts) | Enter an ad-hoc liability not modelled as a full loan account | Net worth completeness for informal debts | Should | 6 | Liability entity | Medium | Manual | None | Yes |
| Loan amortisation schedule (principal/interest split over time) | Full amortisation table | Precise interest-vs-principal insight | Could | Unphased | Loan account | Medium | Automated (computed) | None | No |

## 20. Net Worth

| Feature | Description | User Value | Priority | Phase | Dependencies | Data Sensitivity | Automation | Reg. Risk | MVP |
|---|---|---|---|---|---|---|---|---|---|
| Assets and liabilities aggregation | Sum all assets and liabilities | Foundation of net worth | Must | 6 | Accounts, Holdings, Assets, Liabilities | High | Automated (computed) | None | Yes |
| Net worth (current) | Assets − Liabilities at a point in time | The single headline number | Must | 6 | Assets, Liabilities | High | Automated (computed) | None | Yes |
| Net-worth history / snapshots | Net worth trend over time | See progress over months/years | Must | 6 | Net Worth Snapshot | High | Automated (computed, scheduled) | None | Yes |
| Liquid vs non-liquid split | Classify assets by liquidity | Understand accessible vs locked wealth | Should | 6 | Assets | Medium | Automated (computed) | None | Yes |
| Investment allocation view | Breakdown of investments by asset class | Understand diversification | Should | 8 | Holdings | Medium | Automated (computed) | None | Yes |
| Month-over-month change | Delta vs prior month's snapshot | Immediate trend feedback | Should | 6 | Net Worth Snapshot | Medium | Automated (computed) | None | Yes |
| Manual asset valuation | User-entered value + date for any manual asset | Supports asset classes without live pricing | Must | 6 | Asset entity | High | Manual | None | Yes |

## 21. Goals

| Feature | Description | User Value | Priority | Phase | Dependencies | Data Sensitivity | Automation | Reg. Risk | MVP |
|---|---|---|---|---|---|---|---|---|---|
| Goal definition (target amount, target date) | Define a financial goal | Gives saving/investing a purpose | Should | Unphased (post-9) | Net worth, Accounts | Medium | Manual | None | No |
| Goal progress tracking | Link real account/investment balances to a goal | Grounded, non-static progress | Should | Unphased (post-9) | Goal, Accounts, Holdings | Medium | Automated (computed) | None | No |
| Goal recommendations (e.g., suggested monthly contribution) | Suggest how much to save/invest monthly | Actionable planning help | Could | Unphased | Goal, AI Insights | Medium | Semi-Automated | Medium (must avoid personalised advice framing) | No |

## 22. Tax Support

| Feature | Description | User Value | Priority | Phase | Dependencies | Data Sensitivity | Automation | Reg. Risk | MVP |
|---|---|---|---|---|---|---|---|---|---|
| Capital gains summary (informational only) | Summarise realised gains by holding period (informational, not a filing tool) | Helps the user prepare their own filing | Could | Unphased | Investment Transaction | High | Automated (computed) | Medium | No |
| Tax-saving investment tagging (80C, etc.) | Tag investments relevant to common tax sections | Awareness aid | Could | Unphased | Investment Transaction | Medium | Manual | Medium | No |
| Tax filing / return generation | Prepare or file an actual tax return | — | Won't | Non-goal | — | Critical | — | High | No (explicit non-goal) |

## 23. Documents

| Feature | Description | User Value | Priority | Phase | Dependencies | Data Sensitivity | Automation | Reg. Risk | MVP |
|---|---|---|---|---|---|---|---|---|---|
| Statement/document upload (CSV/PDF) | Upload a source file for import or record-keeping | Central record of source documents | Must | 4 | Secure file storage | High | Manual | None | Yes |
| Document-to-import linkage | Link an uploaded document to its resulting import batch | Full provenance | Must | 4 | Import Batch, Document | High | Automated | None | Yes |
| General document vault (insurance policies, property papers) | Store other financial documents securely | Single secure place for financial paperwork | Could | Unphased | Secure file storage | Critical | Manual | None | No |

## 24. Alerts

| Feature | Description | User Value | Priority | Phase | Dependencies | Data Sensitivity | Automation | Reg. Risk | MVP |
|---|---|---|---|---|---|---|---|---|---|
| Upcoming bill/EMI alerts | Notify before a bill/EMI is due | Avoid missed payments | Should | 10 | Scheduled jobs | Low | Automated | None | Yes |
| Credit card due-date alerts | Notify before card payment due date | Avoid late fees/interest | Should | 10 | Scheduled jobs | Low | Automated | None | Yes |
| Subscription renewal/trial alerts | Notify before renewal/trial end | Avoid unwanted charges | Should | 10 | Scheduled jobs | Low | Automated | None | Yes |
| FD/RD/PPF maturity reminders | Notify ahead of maturity | Timely decision-making | Should | 10 | Scheduled jobs | Low | Automated | None | Yes |
| Budget threshold alerts | Notify when nearing/over budget | Proactive spend control | Should | 10 | Budgets | Low | Automated | None | Yes |
| Unusual-transaction alerts | Notify on an anomaly-flagged transaction | Early error/fraud awareness | Should | 10 | Unusual-expense detection | Medium | Automated | None | Yes |
| Push/mobile notifications | Deliver alerts via mobile push | Timely delivery on the device the user checks most | Should | Unphased (post-14, mobile app) | Expo mobile app | Low | Automated | None | No |

## 25. Market Research

| Feature | Description | User Value | Priority | Phase | Dependencies | Data Sensitivity | Automation | Reg. Risk | MVP |
|---|---|---|---|---|---|---|---|---|---|
| Market index tracking (Nifty/Sensex level display) | Show current/historical index levels for context | Market-condition awareness | Should | 11 | Market-data provider | Low | Automated | None | No |
| Market news aggregation | Surface relevant financial news | Context for the user's holdings | Could | 11 | News provider adapter | Low | Automated | Low | No |
| Market-condition commentary (explainable, source-linked) | Neutral, sourced commentary on market conditions | Understanding without a sales pitch | Could | 12 | AI Insights, Market data | Low | Semi-Automated | Medium | No |

## 26. Company Research

| Feature | Description | User Value | Priority | Phase | Dependencies | Data Sensitivity | Automation | Reg. Risk | MVP |
|---|---|---|---|---|---|---|---|---|---|
| Company fundamentals lookup | Show public fundamentals for a held/researched company | Informed understanding of holdings | Could | 11 | NSE/BSE/company-data provider | Low | Automated | Low | No |
| Corporate filings summary | Summarise public filings (results, announcements) | Stay informed without reading raw filings | Could | 11 | Research Source, Research Report | Low | Semi-Automated | Medium | No |
| Company research report generation | Generate a source-traceable research note on a company | Deeper self-directed research | Could | 11–12 | Research Report, AI Insights | Low | Semi-Automated | Medium (must not read as personalised advice) | No |

## 27. AI Insights

| Feature | Description | User Value | Priority | Phase | Dependencies | Data Sensitivity | Automation | Reg. Risk | MVP |
|---|---|---|---|---|---|---|---|---|---|
| Explainable spend-pattern insight | AI-generated observation about spending, with source data linked | Surfaces patterns the user might miss | Could | 12 | Transactions, AI provider adapter | Medium | Semi-Automated | Low | No |
| Explainable portfolio insight | AI-generated observation about holdings, with source data linked | Understanding, not advice | Could | 12 | Holdings, AI provider adapter | Medium | Semi-Automated | Medium | No |
| Natural-language financial Q&A | Ask questions about one's own data in plain language | Faster access to one's own numbers | Could | 12 | AI provider adapter, all financial data | High | Semi-Automated | Low | No |
| Autonomous AI financial decisions | AI acts on the user's finances without explicit user action | — | Won't | Non-goal | — | Critical | — | High | No (explicit non-goal) |

## 28. Family Finance

| Feature | Description | User Value | Priority | Phase | Dependencies | Data Sensitivity | Automation | Reg. Risk | MVP |
|---|---|---|---|---|---|---|---|---|---|
| Multi-user household accounts | Multiple people share visibility into combined finances | Serves family-level planning | Won't (MVP) / Should (public product) | Unphased (post-15) | Multi-user auth, RLS-based sharing model | Critical | Manual | Medium | No |
| Role-based access within a family | Different visibility/edit rights per family member | Safe, controlled sharing | Won't (MVP) / Should (public product) | Unphased (post-15) | Multi-user accounts | Critical | Manual | Medium | No |

## 29. Public SaaS Capabilities

| Feature | Description | User Value | Priority | Phase | Dependencies | Data Sensitivity | Automation | Reg. Risk | MVP |
|---|---|---|---|---|---|---|---|---|---|
| Multi-tenant user accounts | Independent, isolated accounts for many users | Enables a real product, not just a personal tool | Should (public product) | 15 | Auth, RLS | Critical | Automated | Medium | No |
| Subscription billing plans | Paid tiers for the public product | Business model | Should (public product) | Unphased (post-15) | Multi-tenant accounts, payments provider | High | Automated | Medium | No |
| Admin/support dashboard | Internal tooling to support users | Operational necessity at scale | Should (public product) | Unphased (post-15) | Multi-tenant accounts | Critical | Manual | Medium | No |
| Broker API integrations | Connect a real brokerage for holdings/price sync | Removes manual investment entry | Should (public product) | Unphased (post-15) | Broker partnerships | High | Automated | Medium | No |
| Account Aggregator (AA) integration | Consent-based bank data via RBI-regulated AA framework | Removes manual/CSV bank entry | Should (public product) | Unphased (post-15) | FIU registration/eligibility, legal review | Critical | Automated | High | No |

## 30. Explicit Non-Goal Features (recorded for completeness)

| Feature | Priority | Reg. Risk | MVP |
|---|---|---|---|
| Direct bank login / credential storage | Won't | High | No |
| Bank website scraping | Won't | High | No |
| OTP reading/interception | Won't | Critical | No |
| Automatic/autonomous payment initiation | Won't | High | No |
| Stock/mutual-fund order placement | Won't | High | No |
| Algorithmic trading | Won't | High | No |
| Public personalised buy/sell recommendations | Won't | High | No |
| Cryptocurrency trading | Won't | High | No |

See `04-mvp-scope.md` for the exact must/should/could/won't classification used at the MVP-release
level, and `10-product-roadmap.md` for how phases sequence this inventory into an executable plan.
