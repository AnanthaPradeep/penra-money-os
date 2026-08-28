import { Download, Printer } from "lucide-react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { FinalizeReportForm } from "@/components/tax/FinalizeReportForm";
import { GenerateReportForm } from "@/components/tax/GenerateReportForm";
import { BackLink } from "@/components/ui/BackLink";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { isValidFinancialYearId, parseFinancialYearId } from "@/lib/tax/financial-year";
import { listTaxReportSnapshots } from "@/lib/tax/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type PageProps = { params: Promise<{ financialYear: string }> };

export const metadata: Metadata = { title: "Reports & exports — PENRA Money OS" };

const EXPORTS: { reportType: string; label: string }[] = [
  { reportType: "income", label: "Income summary" },
  { reportType: "interest", label: "Interest report" },
  { reportType: "dividends", label: "Dividend report" },
  { reportType: "capital-gains", label: "Capital gains statement" },
  { reportType: "deductions", label: "Deduction summary" },
  { reportType: "payments", label: "TDS/TCS & payments summary" },
  { reportType: "reconciliation", label: "AIS/26AS reconciliation" },
];

const SNAPSHOT_STATUS_MAP: Record<string, "draft" | "posted" | "reversed" | "matured"> = {
  draft: "draft",
  needs_review: "draft",
  ready: "draft",
  finalized: "posted",
  superseded: "reversed",
};

export default async function TaxReportsPage({ params }: Readonly<PageProps>) {
  const { financialYear } = await params;
  if (!isValidFinancialYearId(financialYear)) {
    notFound();
  }

  const user = await getAuthenticatedUser();
  if (!user) {
    redirect(`/login?next=/app/tax/${financialYear}/reports`);
  }

  const fy = parseFinancialYearId(financialYear);
  const supabase = await createSupabaseServerClient();
  const snapshots = await listTaxReportSnapshots(supabase, financialYear);
  const latestDraft = snapshots.find((s) =>
    ["draft", "needs_review", "ready"].includes(s.status),
  );

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
      <PageHeader
        eyebrow={
          <BackLink href={`/app/tax/${financialYear}`}>
            {`Back to ${fy.label}`}
          </BackLink>
        }
        title="Reports & exports"
        description="For review and planning only — not an income-tax return, not a guarantee of statutory accuracy. Verify against your official records and a qualified professional."
      />

      <section aria-labelledby="snapshots-heading" className="flex flex-col gap-3">
        <SectionHeader id="snapshots-heading" title="Report snapshots" />
        {snapshots.length === 0 ? (
          <EmptyState
            title="No report generated yet"
            description="Generate a draft report from your current tax data below."
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {snapshots.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between gap-4 rounded-lg border border-border bg-elevated px-4 py-3.5 text-sm"
              >
                <div className="flex flex-col gap-0.5">
                  <span className="flex items-center gap-2 font-medium text-foreground">
                    <StatusBadge status={SNAPSHOT_STATUS_MAP[s.status] ?? "draft"} />
                    {s.status}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {s.completenessStatus} · rule set {s.ruleSetVersion} ·
                    generated {s.generatedAt}
                    {s.warnings.length > 0
                      ? ` · ${s.warnings.length} warning(s)`
                      : ""}
                  </span>
                </div>
                {s.status === "draft" ||
                s.status === "needs_review" ||
                s.status === "ready" ? (
                  <FinalizeReportForm
                    snapshotId={s.id}
                    financialYearId={financialYear}
                  />
                ) : null}
              </li>
            ))}
          </ul>
        )}
        <GenerateReportForm financialYearId={financialYear} />
        {latestDraft && latestDraft.warnings.length > 0 ? (
          <div className="rounded-lg border border-border bg-surface p-4 text-xs text-muted-foreground">
            <p className="mb-1 font-medium text-foreground">
              Latest draft warnings:
            </p>
            <ul className="list-disc pl-4">
              {latestDraft.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <section aria-labelledby="print-pack-heading" className="flex flex-col gap-3">
        <SectionHeader id="print-pack-heading" title="Print-friendly review pack" />
        <a
          href={`/app/tax/${financialYear}/reports/print`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between gap-4 rounded-lg border border-border bg-elevated px-4 py-3.5 text-sm font-medium text-foreground transition-colors hover:border-input-border"
        >
          One consolidated page — income, capital gains, deductions, TDS,
          reconciliation, and the old-vs-new comparison. Print or save as
          PDF from your browser.
          <Printer aria-hidden="true" className="size-4 text-muted-foreground" />
        </a>
      </section>

      <section aria-labelledby="exports-heading" className="flex flex-col gap-3">
        <SectionHeader id="exports-heading" title="CSV exports" />
        <ul className="flex flex-col gap-2">
          {EXPORTS.map((e) => (
            <li key={e.reportType}>
              <a
                href={`/app/tax/${financialYear}/export/${e.reportType}`}
                className="flex items-center justify-between gap-4 rounded-lg border border-border bg-elevated px-4 py-3.5 text-sm font-medium text-foreground transition-colors hover:border-input-border"
              >
                {e.label}
                <Download aria-hidden="true" className="size-4 text-muted-foreground" />
              </a>
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">
          Every export is formula-injection-safe and includes the financial
          year, assessment year, rule-set version, completeness status, and
          a review disclaimer.
        </p>
      </section>
    </div>
  );
}
