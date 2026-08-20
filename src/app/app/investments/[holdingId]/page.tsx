import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AddValuationForm } from "@/components/investments/AddValuationForm";
import { ActivityRow } from "@/components/investments/ActivityRow";
import { EditInvestmentAssetForm } from "@/components/investments/EditInvestmentAssetForm";
import { HoldingActions } from "@/components/investments/HoldingActions";
import { MatureFixedDepositDialog } from "@/components/investments/MatureFixedDepositDialog";
import { ValuationRow } from "@/components/investments/ValuationRow";
import { AmountDisplay } from "@/components/ui/AmountDisplay";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { listAccountsWithBalances } from "@/lib/accounts/queries";
import { getAuthenticatedUser } from "@/lib/auth/session";
import {
  getFixedIncomeDetailsForHolding,
  getHoldingSummaryById,
  getInvestmentAssetById,
  getInvestmentHoldingById,
  listActivitiesForHolding,
  listValuationsForHolding,
} from "@/lib/investments/queries";
import { INVESTMENT_ASSET_KIND_LABELS } from "@/lib/investments/types";
import { Decimal } from "@/lib/money/decimal";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type HoldingDetailPageProps = {
  params: Promise<{ holdingId: string }>;
};

export const metadata: Metadata = {
  title: "Investment — PENRA Money OS",
};

export default async function HoldingDetailPage({
  params,
}: Readonly<HoldingDetailPageProps>) {
  const { holdingId } = await params;

  const user = await getAuthenticatedUser();
  if (!user) {
    redirect(`/login?next=/app/investments/${holdingId}`);
  }

  const supabase = await createSupabaseServerClient();
  const holding = await getInvestmentHoldingById(supabase, holdingId);
  if (!holding) {
    notFound();
  }

  const [
    asset,
    summary,
    fixedIncome,
    activities,
    valuations,
    accountsWithBalances,
  ] = await Promise.all([
    getInvestmentAssetById(supabase, holding.investmentAssetId),
    getHoldingSummaryById(supabase, holdingId),
    getFixedIncomeDetailsForHolding(supabase, holdingId),
    listActivitiesForHolding(supabase, holdingId),
    listValuationsForHolding(supabase, holdingId),
    listAccountsWithBalances(supabase),
  ]);

  if (!asset || !summary) {
    notFound();
  }

  const activeAccounts = accountsWithBalances
    .filter((a) => !a.isArchived)
    .map((a) => ({
      id: a.id,
      name: a.name,
      accountType: a.accountType,
      displayBalance: a.displayBalance.toString(),
    }));

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
      <PageHeader
        title={asset.displayName}
        description={`${INVESTMENT_ASSET_KIND_LABELS[asset.assetKind]}${asset.symbol ? ` · ${asset.symbol}` : ""}`}
        actions={
          <div className="flex gap-2">
            <Button asChild>
              <Link href={`/app/investments/${holdingId}/activity`}>
                Record activity
              </Link>
            </Button>
            <HoldingActions holdingId={holdingId} status={holding.status} />
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {summary.quantity.greaterThan(0) ? (
          <Card>
            <CardContent className="flex flex-col gap-1 p-4 pt-4">
              <p className="text-sm text-muted-foreground">Quantity</p>
              <p className="text-xl font-semibold text-foreground">
                {summary.quantity.toString()}
              </p>
              {summary.avgUnitCost ? (
                <p className="text-xs text-muted-foreground">
                  avg cost{" "}
                  <AmountDisplay value={summary.avgUnitCost} size="sm" />
                  /unit
                </p>
              ) : null}
            </CardContent>
          </Card>
        ) : null}
        <Card>
          <CardContent className="flex flex-col gap-1 p-4 pt-4">
            <p className="text-sm text-muted-foreground">Cost basis</p>
            <AmountDisplay value={summary.costBasis} size="lg" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-1 p-4 pt-4">
            <p className="text-sm text-muted-foreground">Current value</p>
            {summary.hasValuation ? (
              <>
                <AmountDisplay value={summary.currentValue} size="lg" />
                <p className="text-xs text-muted-foreground">
                  manual valuation ·{" "}
                  {summary.latestValuationAt
                    ? new Date(summary.latestValuationAt).toLocaleDateString(
                        "en-IN",
                      )
                    : ""}
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                No manual valuation yet
              </p>
            )}
          </CardContent>
        </Card>
        {summary.hasValuation ? (
          <Card>
            <CardContent className="flex flex-col gap-1 p-4 pt-4">
              <p className="text-sm text-muted-foreground">
                Unrealized gain/loss
              </p>
              <AmountDisplay
                value={summary.unrealizedGain ?? new Decimal(0)}
                size="lg"
                variant="signed"
              />
            </CardContent>
          </Card>
        ) : null}
        {summary.realizedGain.abs().greaterThan(0) ? (
          <Card>
            <CardContent className="flex flex-col gap-1 p-4 pt-4">
              <p className="text-sm text-muted-foreground">
                Realized gain/loss
              </p>
              <AmountDisplay
                value={summary.realizedGain}
                size="lg"
                variant="signed"
              />
            </CardContent>
          </Card>
        ) : null}
        {summary.incomeReceived.greaterThan(0) ? (
          <Card>
            <CardContent className="flex flex-col gap-1 p-4 pt-4">
              <p className="text-sm text-muted-foreground">Income received</p>
              <AmountDisplay value={summary.incomeReceived} size="lg" />
            </CardContent>
          </Card>
        ) : null}
      </div>

      {holding.status === "archived" ? <StatusBadge status="archived" /> : null}

      {fixedIncome ? (
        <section
          aria-labelledby="fixed-income-heading"
          className="flex flex-col gap-3"
        >
          <SectionHeader
            id="fixed-income-heading"
            title="Fixed-income details"
          />
          <Card>
            <CardContent className="flex flex-col gap-2 p-4 text-sm">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
                {fixedIncome.provider ? (
                  <>
                    <dt className="text-muted-foreground">Provider</dt>
                    <dd className="text-foreground">{fixedIncome.provider}</dd>
                  </>
                ) : null}
                <dt className="text-muted-foreground">Start date</dt>
                <dd className="text-foreground">{fixedIncome.startDate}</dd>
                {fixedIncome.maturityDate ? (
                  <>
                    <dt className="text-muted-foreground">Maturity date</dt>
                    <dd className="text-foreground">
                      {fixedIncome.maturityDate}
                    </dd>
                  </>
                ) : null}
                {fixedIncome.interestRate ? (
                  <>
                    <dt className="text-muted-foreground">
                      Interest rate (reference)
                    </dt>
                    <dd className="text-foreground">
                      {fixedIncome.interestRate.toString()}%
                    </dd>
                  </>
                ) : null}
                {fixedIncome.expectedMaturityAmount ? (
                  <>
                    <dt className="text-muted-foreground">
                      Expected maturity amount
                    </dt>
                    <dd className="text-foreground">
                      <AmountDisplay
                        value={fixedIncome.expectedMaturityAmount}
                        size="sm"
                      />
                    </dd>
                  </>
                ) : null}
                {fixedIncome.actualMaturityAmount ? (
                  <>
                    <dt className="text-muted-foreground">
                      Actual amount received
                    </dt>
                    <dd className="text-foreground">
                      <AmountDisplay
                        value={fixedIncome.actualMaturityAmount}
                        size="sm"
                      />
                    </dd>
                  </>
                ) : null}
                <dt className="text-muted-foreground">Status</dt>
                <dd>
                  <StatusBadge status={fixedIncome.status} />
                </dd>
              </dl>
              {fixedIncome.status === "active" &&
              (fixedIncome.kind === "fixed_deposit" ||
                fixedIncome.kind === "recurring_deposit") ? (
                <div className="pt-2">
                  <MatureFixedDepositDialog
                    holdingId={holdingId}
                    accounts={activeAccounts.filter(
                      (a) => a.accountType !== "investment",
                    )}
                    expectedMaturityAmount={
                      fixedIncome.expectedMaturityAmount
                        ? fixedIncome.expectedMaturityAmount.toString()
                        : null
                    }
                    idempotencyKey={crypto.randomUUID()}
                  />
                </div>
              ) : null}
            </CardContent>
          </Card>
        </section>
      ) : null}

      <section
        aria-labelledby="valuations-heading"
        className="flex flex-col gap-3"
      >
        <SectionHeader
          id="valuations-heading"
          title="Manual valuation history"
          actions={<AddValuationForm holdingId={holdingId} />}
        />
        {valuations.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No manual valuations recorded yet.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {valuations.map((valuation) => (
              <ValuationRow key={valuation.id} valuation={valuation} />
            ))}
          </ul>
        )}
      </section>

      <section
        aria-labelledby="activity-heading"
        className="flex flex-col gap-3"
      >
        <SectionHeader id="activity-heading" title="Activity history" />
        {activities.length === 0 ? (
          <EmptyState
            title="No activity yet"
            description="Record a purchase, contribution, or valuation to start tracking this holding."
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {activities.map((activity) => (
              <ActivityRow key={activity.id} activity={activity} />
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="edit-heading" className="flex flex-col gap-3">
        <SectionHeader id="edit-heading" title="Edit details" />
        <EditInvestmentAssetForm asset={asset} />
      </section>
    </div>
  );
}
