import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import {
  ChangeDebtRateForm,
  DebtStatusForm,
  RegenerateScheduleForm,
} from "@/components/debts/DebtManagementForms";
import { RecordDebtPaymentForm } from "@/components/debts/RecordDebtPaymentForm";
import { RecordDebtProceedsForm } from "@/components/debts/RecordDebtProceedsForm";
import { listAccountsWithBalances } from "@/lib/accounts/queries";
import { AmountDisplay } from "@/components/ui/AmountDisplay";
import { BackLink } from "@/components/ui/BackLink";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ToastOnParam } from "@/components/ui/ToastOnParam";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { DEBT_TYPE_LABELS } from "@/lib/debts/mapping";
import { getDebtDetail } from "@/lib/debts/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type DebtDetailPageProps = {
  params: Promise<{ debtId: string }>;
  searchParams: Promise<{ created?: string }>;
};

export const metadata: Metadata = { title: "Debt — PENRA Money OS" };

export default async function DebtDetailPage({
  params,
  searchParams,
}: Readonly<DebtDetailPageProps>) {
  const { debtId } = await params;
  const { created } = await searchParams;

  const user = await getAuthenticatedUser();
  if (!user) {
    redirect(`/login?next=/app/debts/${debtId}`);
  }

  const supabase = await createSupabaseServerClient();
  const [detail, accounts] = await Promise.all([
    getDebtDetail(supabase, debtId),
    listAccountsWithBalances(supabase),
  ]);

  if (!detail) {
    notFound();
  }

  const { debt, currentPrincipal, rateHistory, schedule, payments } = detail;
  const assetAccounts = accounts.filter((a) => a.accountClass === "asset");
  const hasNoLedgerActivity =
    currentPrincipal.isZero() && payments.length === 0;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      {created === "1" ? (
        <ToastOnParam param="created" message="Debt created." />
      ) : null}

      <PageHeader
        eyebrow={<BackLink href="/app/debts">Back to debts</BackLink>}
        title={debt.name}
        description={`${DEBT_TYPE_LABELS[debt.debtType]} · ${debt.annualInterestRate.toString()}% p.a.`}
        actions={<StatusBadge status={debt.status} />}
      />

      <div className="flex flex-col gap-1 rounded-lg border border-border bg-surface p-5">
        <span className="text-sm text-muted-foreground">
          Current outstanding principal
        </span>
        <AmountDisplay value={currentPrincipal} size="xl" />
        <span className="text-sm text-muted-foreground">
          Original principal {debt.originalPrincipal.toString()}
          {debt.minimumPayment
            ? ` · minimum payment ${debt.minimumPayment.toString()}`
            : ""}
        </span>
      </div>

      <DebtStatusForm debtId={debt.id} status={debt.status} />

      {hasNoLedgerActivity ? (
        <RecordDebtProceedsForm
          debtId={debt.id}
          receivingAccounts={assetAccounts.map((a) => ({
            id: a.id,
            name: a.name,
          }))}
          idempotencyKey={crypto.randomUUID()}
        />
      ) : null}

      <RecordDebtPaymentForm
        debtId={debt.id}
        paymentAccounts={assetAccounts.map((a) => ({ id: a.id, name: a.name }))}
        idempotencyKey={crypto.randomUUID()}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <ChangeDebtRateForm debtId={debt.id} />
        {debt.interestMethod !== "manual_schedule" ? (
          <RegenerateScheduleForm debtId={debt.id} />
        ) : null}
      </div>

      <section
        aria-labelledby="schedule-heading"
        className="flex flex-col gap-3"
      >
        <SectionHeader id="schedule-heading" title="Payment schedule" />
        {schedule.length === 0 ? (
          <EmptyState
            title="No schedule generated yet"
            description="Generate a payment schedule above to see projected installments — every row is a projection until a payment actually posts against it."
          />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted-surface text-xs text-muted-foreground uppercase">
                <tr>
                  <th className="px-3 py-2 text-left">#</th>
                  <th className="px-3 py-2 text-left">Due</th>
                  <th className="px-3 py-2 text-right">Payment</th>
                  <th className="px-3 py-2 text-right">Principal</th>
                  <th className="px-3 py-2 text-right">Interest</th>
                  <th className="px-3 py-2 text-right">Closing</th>
                  <th className="px-3 py-2 text-right">Paid</th>
                </tr>
              </thead>
              <tbody>
                {schedule.map((row) => {
                  const paid = payments.some(
                    (p) => p.scheduleRowId === row.id && p.status === "posted",
                  );
                  return (
                    <tr key={row.id} className="border-t border-border">
                      <td className="px-3 py-2">{row.installmentNumber}</td>
                      <td className="px-3 py-2">{row.dueDate}</td>
                      <td className="px-3 py-2 text-right">
                        {row.scheduledPayment.toString()}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {row.principalComponent.toString()}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {row.interestComponent.toString()}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {row.closingPrincipal.toString()}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {paid ? "Yes" : ""}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section
        aria-labelledby="payments-heading"
        className="flex flex-col gap-3"
      >
        <SectionHeader id="payments-heading" title="Payment history" />
        {payments.length === 0 ? (
          <EmptyState
            title="No payments recorded yet"
            description="Payments you record will appear here."
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {payments.map((payment) => (
              <li
                key={payment.id}
                className="flex items-center justify-between gap-4 rounded-lg border border-border bg-elevated px-4 py-3.5 text-sm"
              >
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium text-foreground">
                    {payment.paymentType === "prepayment"
                      ? "Prepayment"
                      : "Payment"}
                    {payment.status === "reversed" ? " (reversed)" : ""}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {payment.effectiveDate} · principal{" "}
                    {payment.principalAmount.toString()} · interest{" "}
                    {payment.interestAmount.toString()}
                  </span>
                </div>
                <AmountDisplay
                  value={payment.principalAmount
                    .plus(payment.interestAmount)
                    .plus(payment.feesAmount)}
                  size="sm"
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {rateHistory.length > 1 ? (
        <section
          aria-labelledby="rate-history-heading"
          className="flex flex-col gap-3"
        >
          <SectionHeader id="rate-history-heading" title="Rate history" />
          <ul className="flex flex-col gap-2">
            {rateHistory.map((entry) => (
              <li
                key={entry.id}
                className="flex items-center justify-between gap-4 rounded-lg border border-border bg-elevated px-4 py-3.5 text-sm"
              >
                <span>{entry.effectiveDate}</span>
                <span className="font-medium text-foreground">
                  {entry.annualInterestRate.toString()}%
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
