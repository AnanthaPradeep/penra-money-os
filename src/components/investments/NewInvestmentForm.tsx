"use client";

import {
  Banknote,
  Landmark,
  PiggyBank,
  Repeat,
  TrendingUp,
} from "lucide-react";
import { useState } from "react";

import { FixedDepositForm } from "@/components/investments/FixedDepositForm";
import { PpfForm } from "@/components/investments/PpfForm";
import { RecurringDepositForm } from "@/components/investments/RecurringDepositForm";
import { StockMutualFundForm } from "@/components/investments/StockMutualFundForm";
import type { InvestmentAccountOption } from "@/components/investments/types";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import {
  INVESTMENT_ASSET_KIND_LABELS,
  INVESTMENT_ASSET_KINDS,
  type InvestmentAssetKind,
} from "@/lib/investments/types";

const KIND_ICONS: Record<InvestmentAssetKind, typeof TrendingUp> = {
  stock: TrendingUp,
  mutual_fund: TrendingUp,
  ppf: Landmark,
  fixed_deposit: Banknote,
  recurring_deposit: Repeat,
  other_investment: PiggyBank,
};

type NewInvestmentFormProps = {
  investmentAccounts: InvestmentAccountOption[];
  fundingAccounts: InvestmentAccountOption[];
  fixedDepositIdempotencyKey: string;
  ppfOpeningContributionIdempotencyKey: string;
  defaultKind?: InvestmentAssetKind;
};

/** Top-level kind switcher for creating any investment — mirrors RecurringItemForm's "each kind is its own form component" pattern. */
export function NewInvestmentForm({
  investmentAccounts,
  fundingAccounts,
  fixedDepositIdempotencyKey,
  ppfOpeningContributionIdempotencyKey,
  defaultKind = "stock",
}: Readonly<NewInvestmentFormProps>) {
  const [kind, setKind] = useState<InvestmentAssetKind>(defaultKind);

  const options = INVESTMENT_ASSET_KINDS.map((k) => ({
    value: k,
    label: INVESTMENT_ASSET_KIND_LABELS[k],
    icon: (() => {
      const Icon = KIND_ICONS[k];
      return <Icon aria-hidden="true" className="size-4" />;
    })(),
  }));

  return (
    <div className="flex flex-col gap-6">
      <SegmentedControl
        label="What are you tracking?"
        options={options}
        value={kind}
        onChange={setKind}
      />

      {kind === "stock" ||
      kind === "mutual_fund" ||
      kind === "other_investment" ? (
        <StockMutualFundForm
          assetKind={kind}
          investmentAccounts={investmentAccounts}
        />
      ) : null}
      {kind === "ppf" ? (
        <PpfForm
          investmentAccounts={investmentAccounts}
          fundingAccounts={fundingAccounts}
          openingContributionIdempotencyKey={
            ppfOpeningContributionIdempotencyKey
          }
        />
      ) : null}
      {kind === "fixed_deposit" ? (
        <FixedDepositForm
          investmentAccounts={investmentAccounts}
          fundingAccounts={fundingAccounts}
          idempotencyKey={fixedDepositIdempotencyKey}
        />
      ) : null}
      {kind === "recurring_deposit" ? (
        <RecurringDepositForm
          investmentAccounts={investmentAccounts}
          fundingAccounts={fundingAccounts}
        />
      ) : null}
    </div>
  );
}
