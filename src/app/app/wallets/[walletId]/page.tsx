import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { ArchiveWalletForm } from "@/components/wallets/ArchiveWalletForm";
import { ReallocateWalletForm } from "@/components/wallets/ReallocateWalletForm";
import { WalletAllocationForms } from "@/components/wallets/WalletAllocationForms";
import { WalletMovementRow } from "@/components/wallets/WalletMovementRow";
import { AmountDisplay } from "@/components/ui/AmountDisplay";
import { BackLink } from "@/components/ui/BackLink";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ToastOnParam } from "@/components/ui/ToastOnParam";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getPurposeWallet,
  getPurposeWalletSummaries,
  listPurposeWalletMovements,
  listPurposeWallets,
} from "@/lib/wallets/queries";

type WalletDetailPageProps = {
  params: Promise<{ walletId: string }>;
  searchParams: Promise<{ created?: string }>;
};

export const metadata: Metadata = { title: "Wallet — PENRA Money OS" };

export default async function WalletDetailPage({
  params,
  searchParams,
}: Readonly<WalletDetailPageProps>) {
  const { walletId } = await params;
  const { created } = await searchParams;

  const user = await getAuthenticatedUser();
  if (!user) {
    redirect(`/login?next=/app/wallets/${walletId}`);
  }

  const supabase = await createSupabaseServerClient();
  const wallet = await getPurposeWallet(supabase, walletId);
  if (!wallet) {
    notFound();
  }

  const [summaries, movements, allWallets] = await Promise.all([
    getPurposeWalletSummaries(supabase),
    listPurposeWalletMovements(supabase, walletId, 100),
    listPurposeWallets(supabase, { includeArchived: true }),
  ]);

  const summary = summaries.find((s) => s.walletId === walletId);
  const otherWallets = allWallets
    .filter((w) => w.status === "active")
    .map((w) => ({ id: w.id, name: w.name }));

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      {created === "1" ? (
        <ToastOnParam param="created" message="Wallet created." />
      ) : null}

      <PageHeader
        eyebrow={<BackLink href="/app/wallets">Back to wallets</BackLink>}
        title={wallet.name}
        {...(wallet.description ? { description: wallet.description } : {})}
        actions={
          <>
            <StatusBadge status={wallet.status} />
            <ArchiveWalletForm
              walletId={wallet.id}
              isArchived={wallet.status === "archived"}
            />
          </>
        }
      />

      <div className="flex flex-col gap-1 rounded-lg border border-border bg-surface p-5">
        <span className="text-sm text-muted-foreground">Available</span>
        {/* allocatedBalance is already negative when overspent — no need to derive it from overspentAmount. */}
        <AmountDisplay value={summary?.allocatedBalance ?? "0"} size="xl" />
        {summary?.overspentAmount.gt(0) ? (
          <span className="text-sm font-medium text-negative">
            Overspent by {summary.overspentAmount.toString()}
          </span>
        ) : null}
        {wallet.targetAmount ? (
          <span className="text-sm text-muted-foreground">
            Target {wallet.targetAmount.toString()}
          </span>
        ) : null}
        {summary ? (
          <span className="text-sm text-muted-foreground">
            Spent so far: {summary.spentAmount.toString()}
          </span>
        ) : null}
      </div>

      {wallet.status === "active" ? (
        <>
          <WalletAllocationForms walletId={wallet.id} />
          <ReallocateWalletForm
            currentWalletId={wallet.id}
            wallets={otherWallets}
          />
        </>
      ) : null}

      <section
        aria-labelledby="movements-heading"
        className="flex flex-col gap-3"
      >
        <SectionHeader id="movements-heading" title="History" />
        {movements.length === 0 ? (
          <EmptyState
            title="No activity yet"
            description="Allocations, spends, and transfers involving this wallet will show up here."
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {movements.map((movement) => (
              <WalletMovementRow key={movement.id} movement={movement} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
