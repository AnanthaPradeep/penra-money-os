"use client";

import { Archive, ArchiveRestore } from "lucide-react";
import { useActionState } from "react";

import { Button } from "@/components/ui/Button";
import { INITIAL_WALLET_ACTION_STATE } from "@/lib/wallets/action-state";
import { setPurposeWalletArchivedAction } from "@/lib/wallets/actions";

type ArchiveWalletFormProps = {
  walletId: string;
  isArchived: boolean;
};

export function ArchiveWalletForm({
  walletId,
  isArchived,
}: Readonly<ArchiveWalletFormProps>) {
  const [, formAction] = useActionState(
    setPurposeWalletArchivedAction,
    INITIAL_WALLET_ACTION_STATE,
  );

  return (
    <form action={formAction}>
      <input type="hidden" name="walletId" value={walletId} />
      <input
        type="hidden"
        name="archived"
        value={isArchived ? "false" : "true"}
      />
      <Button type="submit" variant="outline">
        {isArchived ? (
          <>
            <ArchiveRestore aria-hidden="true" className="size-4" />
            Restore wallet
          </>
        ) : (
          <>
            <Archive aria-hidden="true" className="size-4" />
            Archive wallet
          </>
        )}
      </Button>
    </form>
  );
}
