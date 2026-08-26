import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { ReconciliationPanel } from "@/components/bank-import/ReconciliationPanel";
import { BackLink } from "@/components/ui/BackLink";
import { PageHeader } from "@/components/ui/PageHeader";
import { getAuthenticatedUser } from "@/lib/auth/session";
import {
  getStatementImportById,
  listStatementImportRows,
} from "@/lib/bank-import/queries";
import { MAX_STATEMENT_IMPORT_ROWS } from "@/lib/bank-import/limits";
import { computeReconciliation } from "@/lib/bank-import/reconciliation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Reconcile import — PENRA Money OS",
};

type ReconcilePageProps = {
  params: Promise<{ importId: string }>;
};

export default async function ImportReconcilePage({
  params,
}: Readonly<ReconcilePageProps>) {
  const { importId } = await params;

  const user = await getAuthenticatedUser();
  if (!user) {
    redirect(`/login?next=/app/import/${importId}/reconcile`);
  }

  const supabase = await createSupabaseServerClient();
  const importRecord = await getStatementImportById(supabase, importId);
  if (!importRecord) {
    notFound();
  }
  if (
    importRecord.status === "mapping_required" ||
    importRecord.status === "uploaded" ||
    importRecord.status === "parsed"
  ) {
    redirect("/app/import/new");
  }
  if (importRecord.status === "completed") {
    redirect(`/app/import/${importId}?posted=1`);
  }

  const { rows } = await listStatementImportRows(supabase, importId, {
    pageSize: MAX_STATEMENT_IMPORT_ROWS,
  });

  const summary = computeReconciliation({
    importStatus: importRecord.status,
    openingBalance: importRecord.openingBalance,
    closingBalance: importRecord.closingBalance,
    rows: rows.map((row) => ({
      userDecision: row.userDecision,
      amount: row.amount,
      direction: row.direction,
      duplicateStatus: row.duplicateStatus,
      validationErrors: row.validationErrors,
    })),
  });

  const canPost =
    importRecord.status === "ready" || importRecord.status === "failed";

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <PageHeader
        eyebrow={
          <BackLink href={`/app/import/${importId}/review`}>
            Back to review
          </BackLink>
        }
        title="Reconcile & post"
        description={importRecord.originalFilename}
      />

      {!canPost ? (
        <p className="text-sm text-warning">
          This import isn&rsquo;t ready to post yet — go back and mark it ready
          from the review screen first.
        </p>
      ) : null}

      <ReconciliationPanel
        importId={importId}
        summary={summary}
        defaultOpeningBalance={importRecord.openingBalance?.toString() ?? ""}
        defaultClosingBalance={importRecord.closingBalance?.toString() ?? ""}
        canPost={canPost}
      />
    </div>
  );
}
