"use client";

import { CheckCircle2, ExternalLink, PlusCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";

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
import { Field } from "@/components/ui/Field";
import { FormMessage } from "@/components/ui/FormMessage";
import { Label } from "@/components/ui/Label";
import { Select } from "@/components/ui/Select";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { Textarea } from "@/components/ui/Textarea";
import { INITIAL_RESEARCH_ACTION_STATE } from "@/lib/research/action-state";
import { createCompanyFilingAction } from "@/lib/research/actions";
import type { CompanyFiling } from "@/lib/research/mapping";
import {
  FILING_CATEGORIES,
  FILING_CATEGORY_LABELS,
} from "@/lib/research/types";

type FilingsListProps = {
  instrumentId: string;
  filings: CompanyFiling[];
};

/**
 * Manually user-added filing/source links only — this app never fetches
 * source_url server-side, and a link being present here is not proof its
 * content was ever parsed (see the Phase 9 spec's own explicit warning).
 * "Verified" just means the user themself has confirmed the link is
 * correct, not that PENRA validated the document.
 */
export function FilingsList({
  instrumentId,
  filings,
}: Readonly<FilingsListProps>) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline">
              <PlusCircle aria-hidden="true" className="size-4" />
              Add filing link
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add a filing or source link</DialogTitle>
            </DialogHeader>
            <AddFilingForm
              instrumentId={instrumentId}
              onDone={() => setOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      {filings.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No filing links added yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {filings.map((filing) => (
            <li key={filing.id}>
              <Card>
                <CardContent className="flex flex-col gap-1 p-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="neutral">
                      {FILING_CATEGORY_LABELS[filing.category]}
                    </Badge>
                    {filing.isVerified ? (
                      <Badge variant="positive">
                        <CheckCircle2 aria-hidden="true" className="size-3" />
                        Verified by you
                      </Badge>
                    ) : null}
                  </div>
                  <a
                    href={filing.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                  >
                    {filing.title}
                    <ExternalLink aria-hidden="true" className="size-3.5" />
                  </a>
                  <p className="text-xs text-muted-foreground">
                    {filing.sourceDomain}
                    {filing.filingDate ? ` · ${filing.filingDate}` : ""}
                  </p>
                  {filing.notes ? (
                    <p className="text-sm text-muted-foreground">
                      {filing.notes}
                    </p>
                  ) : null}
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AddFilingForm({
  instrumentId,
  onDone,
}: Readonly<{ instrumentId: string; onDone: () => void }>) {
  const [state, formAction] = useActionState(
    createCompanyFilingAction,
    INITIAL_RESEARCH_ACTION_STATE,
  );
  const router = useRouter();

  useEffect(() => {
    if (state.status === "success") {
      router.refresh();
      onDone();
    }
  }, [state, router, onDone]);

  const fieldError = (name: string) =>
    state.status === "error" ? state.fieldErrors?.[name] : undefined;

  return (
    <form action={formAction} noValidate className="flex flex-col gap-4">
      <input type="hidden" name="instrumentId" value={instrumentId} />
      <Field
        id="new-filing-title"
        name="title"
        label="Title"
        required
        placeholder="e.g. FY2025 Annual Report"
        error={fieldError("title")}
      />
      <Select
        id="new-filing-category"
        name="category"
        label="Category"
        defaultValue="other"
        options={FILING_CATEGORIES.map((category) => ({
          value: category,
          label: FILING_CATEGORY_LABELS[category],
        }))}
      />
      <Field
        id="new-filing-source-url"
        name="sourceUrl"
        label="Source URL"
        required
        placeholder="https://www.nseindia.com/..."
        description="Only official NSE/BSE/SEBI pages, the company's own investor-relations site, or a provider-supplied link. This link is never fetched automatically."
        error={fieldError("sourceUrl")}
      />
      <Field
        id="new-filing-date"
        name="filingDate"
        label="Filing date (optional)"
        type="date"
        error={fieldError("filingDate")}
      />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="new-filing-notes">Notes (optional)</Label>
        <Textarea id="new-filing-notes" name="notes" rows={2} />
      </div>
      {state.status === "error" ? (
        <FormMessage message={state.message} tone="error" />
      ) : null}
      <SubmitButton pendingText="Saving…">Add filing link</SubmitButton>
    </form>
  );
}
