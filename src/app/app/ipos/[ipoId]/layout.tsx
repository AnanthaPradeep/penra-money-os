import type { ReactNode } from "react";
import { notFound, redirect } from "next/navigation";

import { IpoSubNav } from "@/components/ipo/IpoSubNav";
import { IPO_STATUS_VARIANTS } from "@/components/ipo/statusVariants";
import { Badge } from "@/components/ui/Badge";
import { BackLink } from "@/components/ui/BackLink";
import { PageHeader } from "@/components/ui/PageHeader";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { getIpoIssueById } from "@/lib/ipo/queries";
import { IPO_STATUS_LABELS } from "@/lib/ipo/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type IpoLayoutProps = {
  children: ReactNode;
  params: Promise<{ ipoId: string }>;
};

/** Shared shell for every /app/ipos/[ipoId]/* route — fetches the IPO once and 404s the whole subtree if it doesn't exist. */
export default async function IpoLayout({
  children,
  params,
}: Readonly<IpoLayoutProps>) {
  const { ipoId } = await params;

  const user = await getAuthenticatedUser();
  if (!user) {
    redirect(`/login?next=/app/ipos/${ipoId}`);
  }

  const supabase = await createSupabaseServerClient();
  const ipo = await getIpoIssueById(supabase, ipoId);
  if (!ipo) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow={<BackLink href="/app/ipos">IPOs</BackLink>}
        title={ipo.issuerName}
        description={[
          ipo.board === "mainboard" ? "Mainboard" : "SME",
          ipo.exchange,
        ]
          .filter(Boolean)
          .join(" · ")}
        actions={
          <Badge variant={IPO_STATUS_VARIANTS[ipo.status]}>
            {IPO_STATUS_LABELS[ipo.status]}
          </Badge>
        }
      />
      <IpoSubNav ipoId={ipoId} />
      {children}
    </div>
  );
}
