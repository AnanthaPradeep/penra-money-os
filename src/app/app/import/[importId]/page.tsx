import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { DiscardImportButton } from "@/components/bank-import/DiscardImportButton";
import { BackLink } from "@/components/ui/BackLink";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ToastOnParam } from "@/components/ui/ToastOnParam";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { MAX_STATEMENT_IMPORT_ROWS } from "@/lib/bank-import/limits";
import {
  getStatementImportById,
  listStatementImportRows,
} from "@/lib/bank-import/queries";
import { formatIstDateTime } from "@/lib/dates/timezone";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Import — PENRA Money OS",
};

type ImportDetailPageProps = {
  params: Promise<{ importId: string }>;
  searchParams: Promise<{ posted?: string }>;
};

function statusForBadge(status: string) {
  return status as Parameters<typeof StatusBadge>[0]["status"];
}

export default async function ImportDetailPage({
  params,
  searchParams,
}: Readonly<ImportDetailPageProps>) {
  const { importId } = await params;
  const { posted } = await searchParams;

  const user = await getAuthenticatedUser();
  if (!user) {
    redirect(`/login?next=/app/import/${importId}`);
  }

  const supabase = await createSupabaseServerClient();
  const importRecord = await getStatementImportById(supabase, importId);
  if (!importRecord) {
    notFound();
  }

  if (
    importRecord.status === "mapping_required" ||
    importRecord.status === "uploaded" ||
    importRecord.status === "parsed" ||
    importRecord.status === "reviewing"
  ) {
    redirect(`/app/import/${importId}/review`);
  }
  if (importRecord.status === "ready" || importRecord.status === "posting") {
    redirect(`/app/import/${importId}/reconcile`);
  }

  const { rows: postedRows } = await listStatementImportRows(
    supabase,
    importId,
    {
      decisionFilter: "include",
      pageSize: MAX_STATEMENT_IMPORT_ROWS,
    },
  );
  const linkedTransactions = postedRows
    .map(
      (row) =>
        row.linkedCreatedTransactionId ?? row.linkedExistingTransactionId,
    )
    .filter((id): id is string => id !== null);

  const canDiscard = importRecord.status === "failed";

  return (
    <div className="flex flex-col gap-6">
      {posted === "1" ? (
        <ToastOnParam param="posted" message="Import posted." />
      ) : null}

      <PageHeader
        eyebrow={<BackLink href="/app/import">Back to imports</BackLink>}
        title={importRecord.originalFilename}
        description={`Uploaded ${formatIstDateTime(importRecord.createdAt)}`}
        actions={
          <>
            <StatusBadge status={statusForBadge(importRecord.status)} />
            {importRecord.status === "completed" ? (
              <StatusBadge
                status={
                  importRecord.reconciliationStatus === "balanced"
                    ? "balanced"
                    : "unreconciled"
                }
              />
            ) : null}
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="flex flex-col gap-1 p-4 pt-4">
            <p className="text-xs text-muted-foreground">Total rows</p>
            <p className="text-xl font-semibold text-foreground">
              {importRecord.totalRows}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-1 p-4 pt-4">
            <p className="text-xs text-muted-foreground">Imported</p>
            <p className="text-xl font-semibold text-foreground">
              {importRecord.importedRows}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-1 p-4 pt-4">
            <p className="text-xs text-muted-foreground">Matched</p>
            <p className="text-xl font-semibold text-foreground">
              {importRecord.matchedRows}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-1 p-4 pt-4">
            <p className="text-xs text-muted-foreground">Duplicates flagged</p>
            <p className="text-xl font-semibold text-foreground">
              {importRecord.duplicateRows}
            </p>
          </CardContent>
        </Card>
      </div>

      {importRecord.status === "failed" ? (
        <p className="text-sm text-negative">
          Posting failed and nothing was recorded (error code:{" "}
          {importRecord.errorCode ?? "unknown"}). You can retry from the
          reconciliation screen, or discard this import.
        </p>
      ) : null}

      {importRecord.status === "completed" && linkedTransactions.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
            Posted transactions
          </h2>
          <p className="text-sm text-muted-foreground">
            To correct or reverse a posted transaction, open it from your
            transaction list — imports reuse the same reversal workflow as any
            other transaction.
          </p>
          <Link
            href="/app/transactions"
            className="text-sm font-medium text-primary hover:underline"
          >
            View transactions ({linkedTransactions.length} from this import)
          </Link>
        </section>
      ) : null}

      <div className="flex gap-3">
        {importRecord.status === "failed" ? (
          <Button asChild>
            <Link href={`/app/import/${importId}/reconcile`}>
              Retry posting
            </Link>
          </Button>
        ) : null}
        {canDiscard ? <DiscardImportButton importId={importId} /> : null}
      </div>
    </div>
  );
}
