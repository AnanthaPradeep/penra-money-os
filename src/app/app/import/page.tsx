import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { FileUp, History, PlusCircle } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { listStatementImports } from "@/lib/bank-import/queries";
import { formatIstDateTime } from "@/lib/dates/timezone";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Import — PENRA Money OS",
};

const ACTIVE_STATUSES = [
  "uploaded",
  "mapping_required",
  "parsed",
  "reviewing",
  "ready",
  "posting",
  "failed",
] as const;

function statusForBadge(status: string) {
  return status as Parameters<typeof StatusBadge>[0]["status"];
}

export default async function ImportHubPage() {
  const user = await getAuthenticatedUser();
  if (!user) {
    redirect("/login?next=/app/import");
  }

  const supabase = await createSupabaseServerClient();
  const allImports = await listStatementImports(supabase);
  const activeImports = allImports.filter((imp) =>
    (ACTIVE_STATUSES as readonly string[]).includes(imp.status),
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Bank statement import"
        description="Upload a bank or credit-card statement, review the parsed rows, and post confirmed transactions to your ledger."
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/app/import/history">
                <History aria-hidden="true" className="size-4" />
                History
              </Link>
            </Button>
            <Button asChild>
              <Link href="/app/import/new">
                <PlusCircle aria-hidden="true" className="size-4" />
                Import a statement
              </Link>
            </Button>
          </>
        }
      />

      {activeImports.length === 0 ? (
        <EmptyState
          icon={<FileUp aria-hidden="true" className="size-6" />}
          title="No imports in progress"
          description="Upload a CSV or TSV export from your bank to get started — nothing posts to your ledger until you review and confirm it."
          action={
            <Button asChild>
              <Link href="/app/import/new">
                <PlusCircle aria-hidden="true" className="size-4" />
                Import a statement
              </Link>
            </Button>
          }
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {activeImports.map((imp) => (
            <li key={imp.id}>
              <Link
                href={
                  imp.status === "mapping_required"
                    ? "/app/import/new"
                    : `/app/import/${imp.id}`
                }
              >
                <Card className="transition-colors hover:border-input-border">
                  <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4 pt-4">
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="truncate font-medium text-foreground">
                        {imp.originalFilename}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Uploaded {formatIstDateTime(imp.createdAt)} ·{" "}
                        {imp.totalRows} rows
                      </span>
                    </div>
                    <StatusBadge status={statusForBadge(imp.status)} />
                  </CardContent>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
