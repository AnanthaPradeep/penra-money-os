import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { History } from "lucide-react";

import { BackLink } from "@/components/ui/BackLink";
import { Card, CardContent } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { listStatementImports } from "@/lib/bank-import/queries";
import { formatIstDateTime } from "@/lib/dates/timezone";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Import history — PENRA Money OS",
};

function statusForBadge(status: string) {
  return status as Parameters<typeof StatusBadge>[0]["status"];
}

export default async function ImportHistoryPage() {
  const user = await getAuthenticatedUser();
  if (!user) {
    redirect("/login?next=/app/import/history");
  }

  const supabase = await createSupabaseServerClient();
  const imports = await listStatementImports(supabase);
  const finished = imports.filter(
    (imp) => imp.status === "completed" || imp.status === "discarded",
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow={<BackLink href="/app/import">Back to imports</BackLink>}
        title="Import history"
        description="Completed and discarded statement imports."
      />

      {finished.length === 0 ? (
        <EmptyState
          icon={<History aria-hidden="true" className="size-6" />}
          title="No finished imports yet"
          description="Completed and discarded imports will show up here."
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {finished.map((imp) => (
            <li key={imp.id}>
              <Link href={`/app/import/${imp.id}`}>
                <Card className="transition-colors hover:border-input-border">
                  <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4 pt-4">
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="truncate font-medium text-foreground">
                        {imp.originalFilename}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {imp.status === "completed"
                          ? `Completed ${imp.completedAt ? formatIstDateTime(imp.completedAt) : ""}`
                          : `Uploaded ${formatIstDateTime(imp.createdAt)}`}{" "}
                        · {imp.importedRows} imported
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={statusForBadge(imp.status)} />
                      {imp.status === "completed" ? (
                        <StatusBadge
                          status={
                            imp.reconciliationStatus === "balanced"
                              ? "balanced"
                              : "unreconciled"
                          }
                        />
                      ) : null}
                    </div>
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
