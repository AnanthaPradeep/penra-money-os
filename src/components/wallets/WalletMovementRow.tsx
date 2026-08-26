import { AmountDisplay } from "@/components/ui/AmountDisplay";
import { formatIstDateTime } from "@/lib/dates/timezone";
import type { PurposeWalletMovement } from "@/lib/wallets/mapping";

const MOVEMENT_KIND_LABELS: Record<
  PurposeWalletMovement["movementKind"],
  string
> = {
  manual_allocation: "Added to wallet",
  reallocation_in: "Moved in from another wallet",
  reallocation_out: "Moved out to another wallet",
  income_plan_allocation: "Allocated from income",
  goal_contribution: "Goal contribution",
  goal_withdrawal: "Goal withdrawal",
  expense_spend: "Spent",
  expense_reversal: "Restored (transaction reversed)",
  release: "Released from wallet",
};

export function WalletMovementRow({
  movement,
}: Readonly<{ movement: PurposeWalletMovement }>) {
  return (
    <li className="flex items-center justify-between gap-4 rounded-lg border border-border bg-elevated px-4 py-3.5 text-sm">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate font-medium text-foreground">
          {MOVEMENT_KIND_LABELS[movement.movementKind]}
        </span>
        <span className="truncate text-xs text-muted-foreground">
          {formatIstDateTime(movement.createdAt)}
          {movement.memo ? ` · ${movement.memo}` : ""}
        </span>
      </div>
      <AmountDisplay value={movement.amount} variant="signed" size="sm" />
    </li>
  );
}
