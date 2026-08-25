"use client";

import { PlusCircle, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";

import { AddIpoFinancialMetricForm } from "@/components/ipo/AddIpoFinancialMetricForm";
import { AmountDisplay } from "@/components/ui/AmountDisplay";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/Dialog";
import type { IpoDocument, IpoFinancialMetric } from "@/lib/ipo/mapping";
import { IPO_METRIC_LABELS } from "@/lib/ipo/types";

type IpoFinancialsPanelProps = {
  ipoIssueId: string;
  metrics: IpoFinancialMetric[];
  documents: IpoDocument[];
};

export function IpoFinancialsPanel({
  ipoIssueId,
  metrics,
  documents,
}: Readonly<IpoFinancialsPanelProps>) {
  const [addOpen, setAddOpen] = useState(false);

  const byPeriod = useMemo(() => {
    const groups = new Map<string, IpoFinancialMetric[]>();
    for (const metric of metrics) {
      const existing = groups.get(metric.fiscalPeriodEnd) ?? [];
      existing.push(metric);
      groups.set(metric.fiscalPeriodEnd, existing);
    }
    return [...groups.entries()].sort(([a], [b]) => b.localeCompare(a));
  }, [metrics]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Historical figures from the issuer&apos;s own filings, cited per
          value. Not calculated valuation ratios without verified inputs.
        </p>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <PlusCircle aria-hidden="true" className="size-4" />
              Add metric
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add a source-cited financial metric</DialogTitle>
            </DialogHeader>
            <AddIpoFinancialMetricForm
              ipoIssueId={ipoIssueId}
              documents={documents}
              onDone={() => setAddOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      {byPeriod.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No financial data recorded yet.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {byPeriod.map(([period, periodMetrics]) => (
            <Card key={period}>
              <CardContent className="flex flex-col gap-3 p-4">
                <p className="text-sm font-semibold text-foreground">
                  Period ended {period}
                </p>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
                  {periodMetrics.map((metric) => (
                    <div key={metric.id}>
                      <dt className="flex items-center gap-1.5 text-muted-foreground">
                        {IPO_METRIC_LABELS[metric.metricKey]}
                        {metric.humanVerified ? (
                          <ShieldCheck
                            aria-hidden="true"
                            className="size-3 text-positive"
                          />
                        ) : null}
                      </dt>
                      <dd className="font-medium text-foreground">
                        <AmountDisplay value={metric.value} size="sm" />
                      </dd>
                    </div>
                  ))}
                </dl>
                <div className="flex flex-wrap gap-2 text-xs">
                  <Badge variant="neutral">
                    {periodMetrics[0]?.statementBasis === "standalone"
                      ? "Standalone"
                      : "Consolidated"}
                  </Badge>
                  {periodMetrics.some((m) => m.sourceCitation) ? (
                    <span className="text-muted-foreground">
                      {
                        periodMetrics.find((m) => m.sourceCitation)
                          ?.sourceCitation
                      }
                    </span>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
