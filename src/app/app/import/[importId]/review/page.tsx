import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { ImportReviewTable } from "@/components/bank-import/ImportReviewTable";
import type { ReviewRow } from "@/components/bank-import/ImportRowCard";
import { MarkImportReadyButton } from "@/components/bank-import/MarkImportReadyButton";
import { BackLink } from "@/components/ui/BackLink";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { getAuthenticatedUser } from "@/lib/auth/session";
import type { RowMatch } from "@/lib/bank-import/mapping";
import {
  getStatementImportById,
  listRowMatchesByRowIds,
  listStatementImportRows,
} from "@/lib/bank-import/queries";
import { listCategories } from "@/lib/categories/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPurposeWalletSummaries } from "@/lib/wallets/queries";

export const metadata: Metadata = {
  title: "Review import — PENRA Money OS",
};

type ReviewPageProps = {
  params: Promise<{ importId: string }>;
  searchParams: Promise<{ page?: string; search?: string; decision?: string }>;
};

export default async function ImportReviewPage({
  params,
  searchParams,
}: Readonly<ReviewPageProps>) {
  const { importId } = await params;
  const { page, search, decision } = await searchParams;

  const user = await getAuthenticatedUser();
  if (!user) {
    redirect(`/login?next=/app/import/${importId}/review`);
  }

  const supabase = await createSupabaseServerClient();
  const importRecord = await getStatementImportById(supabase, importId);
  if (!importRecord) {
    notFound();
  }
  if (
    importRecord.status === "mapping_required" ||
    importRecord.status === "uploaded"
  ) {
    redirect("/app/import/new");
  }
  if (
    importRecord.status === "completed" ||
    importRecord.status === "posting"
  ) {
    redirect(`/app/import/${importId}`);
  }

  const pageNumber = Number.parseInt(page ?? "1", 10) || 1;
  const decisionFilter =
    decision === "pending" || decision === "include" || decision === "exclude"
      ? decision
      : undefined;

  const [{ rows, totalCount }, incomeCategories, expenseCategories, walletSummaries] =
    await Promise.all([
      listStatementImportRows(supabase, importId, {
        page: pageNumber,
        pageSize: 50,
        ...(search ? { search } : {}),
        ...(decisionFilter ? { decisionFilter } : {}),
      }),
      listCategories(supabase, "income"),
      listCategories(supabase, "expense"),
      getPurposeWalletSummaries(supabase),
    ]);

  const matchesByRowId = await listRowMatchesByRowIds(
    supabase,
    rows.map((r) => r.id),
  );
  const matchesByRowIdPlain: Record<string, RowMatch[]> = {};
  for (const [rowId, matches] of matchesByRowId.entries()) {
    matchesByRowIdPlain[rowId] = matches;
  }

  const reviewRows: ReviewRow[] = rows.map((row) => ({
    id: row.id,
    transactionDate: row.transactionDate,
    description: row.description,
    reference: row.reference,
    amount: row.amount ? row.amount.toString() : null,
    direction: row.direction,
    duplicateStatus: row.duplicateStatus,
    matchStatus: row.matchStatus,
    userDecision: row.userDecision,
    resolvedTransactionType: row.resolvedTransactionType,
    suggestedCategoryId: row.suggestedCategoryId,
    walletId: row.walletId,
    hasRuleConflict: row.hasRuleConflict,
    linkedExistingTransactionId: row.linkedExistingTransactionId,
    transferGroupId: row.transferGroupId,
    validationErrorCount: row.validationErrors.length,
  }));

  const incomeCategoryOptions = incomeCategories.map((c) => ({
    value: c.id,
    label: c.name,
  }));
  const expenseCategoryOptions = expenseCategories.map((c) => ({
    value: c.id,
    label: c.name,
  }));
  const walletOptions = walletSummaries
    .filter((w) => w.status === "active")
    .map((w) => ({ value: w.walletId, label: w.name }));

  const totalPages = Math.max(1, Math.ceil(totalCount / 50));
  const includedCount = importRecord.validRows - importRecord.invalidRows;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow={<BackLink href="/app/import">Back to imports</BackLink>}
        title={importRecord.originalFilename}
        description={`${importRecord.totalRows} rows · ${importRecord.duplicateRows} flagged as duplicates · ${includedCount} valid`}
        actions={
          importRecord.status === "reviewing" ? (
            <MarkImportReadyButton importId={importId} />
          ) : (
            <Button asChild>
              <Link href={`/app/import/${importId}/reconcile`}>
                Continue to reconciliation
              </Link>
            </Button>
          )
        }
      />

      <form method="get" className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          name="search"
          defaultValue={search}
          placeholder="Search description or reference"
          className="h-10 w-64 rounded-md border border-input-border bg-background px-3 text-sm text-foreground"
        />
        <select
          name="decision"
          defaultValue={decisionFilter ?? ""}
          className="h-10 rounded-md border border-input-border bg-background px-3 text-sm text-foreground"
        >
          <option value="">All decisions</option>
          <option value="pending">Pending</option>
          <option value="include">Include</option>
          <option value="exclude">Exclude</option>
        </select>
        <button
          type="submit"
          className="h-10 rounded-md border border-input-border px-3 text-sm font-medium text-foreground hover:bg-muted-surface"
        >
          Filter
        </button>
      </form>

      <ImportReviewTable
        importId={importId}
        rows={reviewRows}
        matchesByRowId={matchesByRowIdPlain}
        incomeCategoryOptions={incomeCategoryOptions}
        expenseCategoryOptions={expenseCategoryOptions}
        walletOptions={walletOptions}
      />

      {totalPages > 1 ? (
        <div className="flex items-center gap-2 text-sm">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <Link
              key={p}
              href={`/app/import/${importId}/review?page=${p}${search ? `&search=${encodeURIComponent(search)}` : ""}${decisionFilter ? `&decision=${decisionFilter}` : ""}`}
              className={
                p === pageNumber
                  ? "font-semibold text-foreground underline"
                  : "text-muted-foreground hover:underline"
              }
            >
              {p}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
