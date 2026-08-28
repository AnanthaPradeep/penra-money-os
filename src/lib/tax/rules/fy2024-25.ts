import { Decimal } from "@/lib/money/decimal";
import type { TaxRuleSet } from "@/lib/tax/rules/types";

/**
 * FY 2024-25 (AY 2025-26), individual resident, non-business/profession.
 *
 * Notable feature of this specific year: the Union Budget 2024 (23 July
 * 2024) raised listed-equity/equity-MF LTCG from 10% to 12.5% (and the
 * u/s 112A exemption from ₹1,00,000 to ₹1,25,000) and STCG from 15% to
 * 20%, effective for transfers ON OR AFTER 23 July 2024 — transfers
 * earlier in the same financial year still used the old rates. This is
 * why `capitalGains.rates` below has two entries per (assetClass, term)
 * with adjoining effectiveFrom/effectiveTo windows, rather than one rate
 * for the whole year.
 *
 * Old-regime slabs are the long-standing, unrevised general (below-60)
 * individual slabs. This rule set intentionally only covers the general
 * age band — senior/super-senior citizen slabs are a distinct, narrower
 * rule this registry does not yet support (see registry.ts).
 */
export const FY_2024_25: TaxRuleSet = {
  financialYearId: "2024-25",
  assessmentYearId: "2025-26",
  ruleSetVersion: "in-individual-2024-25.v1",
  effectiveFrom: "2024-04-01",
  effectiveTo: "2025-03-31",
  taxpayerScope: {
    taxpayerType: "individual",
    residentialStatus: "resident",
    businessOrProfession: false,
    currency: "INR",
  },
  regimes: {
    old: {
      slabs: [
        { from: new Decimal(0), to: new Decimal(250000), ratePercent: new Decimal(0) },
        { from: new Decimal(250000), to: new Decimal(500000), ratePercent: new Decimal(5) },
        { from: new Decimal(500000), to: new Decimal(1000000), ratePercent: new Decimal(20) },
        { from: new Decimal(1000000), to: null, ratePercent: new Decimal(30) },
      ],
      rebate: {
        thresholdIncome: new Decimal(500000),
        maxRebateAmount: new Decimal(12500),
        section: "87A",
      },
      standardDeduction: new Decimal(50000),
      cessPercent: new Decimal(4),
      surchargeSupportedUpToIncome: new Decimal(5000000),
      deductionSectionsAllowed: [
        "80C", "80D", "80E", "80G", "80TTA", "80TTB", "24b", "HRA",
      ],
    },
    new: {
      slabs: [
        { from: new Decimal(0), to: new Decimal(300000), ratePercent: new Decimal(0) },
        { from: new Decimal(300000), to: new Decimal(700000), ratePercent: new Decimal(5) },
        { from: new Decimal(700000), to: new Decimal(1000000), ratePercent: new Decimal(10) },
        { from: new Decimal(1000000), to: new Decimal(1200000), ratePercent: new Decimal(15) },
        { from: new Decimal(1200000), to: new Decimal(1500000), ratePercent: new Decimal(20) },
        { from: new Decimal(1500000), to: null, ratePercent: new Decimal(30) },
      ],
      rebate: {
        thresholdIncome: new Decimal(700000),
        maxRebateAmount: new Decimal(25000),
        section: "87A",
      },
      standardDeduction: new Decimal(75000),
      cessPercent: new Decimal(4),
      surchargeSupportedUpToIncome: new Decimal(5000000),
      deductionSectionsAllowed: ["80CCD(2)"],
    },
  },
  capitalGains: {
    holdingPeriodThresholds: [
      { assetClass: "listed_equity", longTermThresholdMonths: 12 },
      { assetClass: "equity_oriented_mutual_fund", longTermThresholdMonths: 12 },
    ],
    rates: [
      {
        assetClass: "listed_equity",
        term: "long_term",
        ratePercent: new Decimal(10),
        exemptionAmount: new Decimal(100000),
        effectiveFrom: "2024-04-01",
        effectiveTo: "2024-07-22",
      },
      {
        assetClass: "listed_equity",
        term: "long_term",
        ratePercent: new Decimal(12.5),
        exemptionAmount: new Decimal(125000),
        effectiveFrom: "2024-07-23",
        effectiveTo: null,
      },
      {
        assetClass: "listed_equity",
        term: "short_term",
        ratePercent: new Decimal(15),
        exemptionAmount: null,
        effectiveFrom: "2024-04-01",
        effectiveTo: "2024-07-22",
      },
      {
        assetClass: "listed_equity",
        term: "short_term",
        ratePercent: new Decimal(20),
        exemptionAmount: null,
        effectiveFrom: "2024-07-23",
        effectiveTo: null,
      },
      {
        assetClass: "equity_oriented_mutual_fund",
        term: "long_term",
        ratePercent: new Decimal(10),
        exemptionAmount: new Decimal(100000),
        effectiveFrom: "2024-04-01",
        effectiveTo: "2024-07-22",
      },
      {
        assetClass: "equity_oriented_mutual_fund",
        term: "long_term",
        ratePercent: new Decimal(12.5),
        exemptionAmount: new Decimal(125000),
        effectiveFrom: "2024-07-23",
        effectiveTo: null,
      },
      {
        assetClass: "equity_oriented_mutual_fund",
        term: "short_term",
        ratePercent: new Decimal(15),
        exemptionAmount: null,
        effectiveFrom: "2024-04-01",
        effectiveTo: "2024-07-22",
      },
      {
        assetClass: "equity_oriented_mutual_fund",
        term: "short_term",
        ratePercent: new Decimal(20),
        exemptionAmount: null,
        effectiveFrom: "2024-07-23",
        effectiveTo: null,
      },
    ],
    grandfatheringSupported: false,
    indexationSupported: false,
  },
  deductionCatalog: [
    { section: "80C", label: "Section 80C (PPF, ELSS, life insurance, etc.)", maxAmount: new Decimal(150000), regimes: ["old"] },
    { section: "80D", label: "Section 80D (health insurance premium)", maxAmount: new Decimal(25000), regimes: ["old"] },
    { section: "80E", label: "Section 80E (education loan interest)", maxAmount: null, regimes: ["old"] },
    { section: "80G", label: "Section 80G (donations)", maxAmount: null, regimes: ["old"] },
    { section: "80TTA", label: "Section 80TTA (savings account interest)", maxAmount: new Decimal(10000), regimes: ["old"] },
    { section: "80TTB", label: "Section 80TTB (senior-citizen interest income)", maxAmount: new Decimal(50000), regimes: ["old"] },
    { section: "24b", label: "Section 24(b) (home loan interest — self-occupied)", maxAmount: new Decimal(200000), regimes: ["old"] },
    { section: "80CCD(2)", label: "Section 80CCD(2) (employer NPS contribution)", maxAmount: null, regimes: ["old", "new"] },
  ],
  source: {
    title: "Finance (No. 2) Act, 2024 — individual income-tax provisions for AY 2025-26",
    url: "https://incometaxindia.gov.in/pages/acts/finance-acts.aspx",
    publishedDate: "2024-08-16",
  },
};
