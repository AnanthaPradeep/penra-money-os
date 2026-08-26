import { AlertTriangle, Wallet2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { CreateWalletDialog } from "@/components/wallets/CreateWalletDialog";
import { AmountDisplay } from "@/components/ui/AmountDisplay";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { formatIstDateTime } from "@/lib/dates/timezone";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getPurposeWalletSummaries,
  getSafeToSpendSummary,
} from "@/lib/wallets/queries";

export const metadata: Metadata = {
  title: "Wallets — PENRA Money OS",
};

export default async function WalletsPage() {
  const user = await getAuthenticatedUser();
  if (!user) {
    redirect("/login?next=/app/wallets");
  }

  const supabase = await createSupabaseServerClient();
  const [summaries, safeToSpend] = await Promise.all([
    getPurposeWalletSummaries(supabase),
    getSafeToSpendSummary(supabase),
  ]);

  const active = summaries.filter((w) => w.status === "active");
  const archived = summaries.filter((w) => w.status === "archived");

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Wallets"
        description="Earmark money you already have toward what it's for — never a separate account, never counted twice."
        actions={<CreateWalletDialog />}
      />

      {safeToSpend ? (
        <Card>
          <CardContent className="flex flex-col gap-3 pt-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium text-muted-foreground">
                Safe to spend (estimate)
              </span>
              <AmountDisplay value={safeToSpend.safeToSpend} size="xl" />
              <span className="text-xs text-muted-foreground">
                {formatIstDateTime(safeToSpend.asOf)} · eligible balance{" "}
                {safeToSpend.eligibleLiquidBalance.toString()} minus earmarked{" "}
                {safeToSpend.earmarkedAllocation.toString()} minus near-term
                commitments {safeToSpend.nearTermCommitments.toString()}
              </span>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {summaries.length === 0 ? (
        <EmptyState
          icon={<Wallet2 aria-hidden="true" className="size-6" />}
          title="No wallets yet"
          description="Create a wallet to earmark money you already have toward groceries, travel, an emergency fund, or anything else — without moving it to a new account."
          action={<CreateWalletDialog />}
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {active.map((wallet) => (
            <li key={wallet.walletId}>
              <Link
                href={`/app/wallets/${wallet.walletId}`}
                className="flex items-center justify-between gap-4 rounded-lg border border-border bg-elevated px-4 py-3.5 transition-colors hover:border-input-border"
              >
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="flex items-center gap-2 truncate text-sm font-medium text-foreground">
                    {wallet.name}
                    {wallet.fundingMode === "planning_only" ? (
                      <Badge variant="info">Planning only</Badge>
                    ) : null}
                    {wallet.overspentAmount.gt(0) ? (
                      <Badge variant="negative">
                        <AlertTriangle aria-hidden="true" className="size-3" />
                        Overspent
                      </Badge>
                    ) : null}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {wallet.targetAmount
                      ? `Target ${wallet.targetAmount.toString()}`
                      : "No target set"}
                  </span>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-0.5">
                  {/* allocatedBalance is already negative when overspent — no need to derive it from overspentAmount. */}
                  <AmountDisplay value={wallet.allocatedBalance} size="md" />
                  <span className="text-xs text-muted-foreground">
                    available
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {archived.length > 0 ? (
        <details className="group flex flex-col gap-3">
          <summary className="w-fit cursor-pointer list-none text-sm font-semibold tracking-wide text-muted-foreground uppercase select-none">
            Archived ({archived.length})
          </summary>
          <ul className="mt-3 flex flex-col gap-2">
            {archived.map((wallet) => (
              <li key={wallet.walletId}>
                <Link
                  href={`/app/wallets/${wallet.walletId}`}
                  className="flex items-center justify-between gap-4 rounded-lg border border-border bg-elevated px-4 py-3.5 transition-colors hover:border-input-border"
                >
                  <span className="truncate text-sm font-medium text-foreground">
                    {wallet.name}
                  </span>
                  <AmountDisplay value={wallet.allocatedBalance} size="sm" />
                </Link>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
