"use client";

import { Pencil } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";

import {
  IDEA_STATUS_VARIANTS,
  PRIORITY_LABELS,
  PRIORITY_VARIANTS,
} from "@/components/research/statusVariants";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { FormMessage } from "@/components/ui/FormMessage";
import { Label } from "@/components/ui/Label";
import { Select } from "@/components/ui/Select";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { Textarea } from "@/components/ui/Textarea";
import { INITIAL_RESEARCH_ACTION_STATE } from "@/lib/research/action-state";
import { updateInvestmentIdeaAction } from "@/lib/research/actions";
import type {
  InvestmentIdea,
  InvestmentThesis,
  ResearchReviewEvent,
} from "@/lib/research/mapping";
import {
  IDEA_STATUS_LABELS,
  IDEA_STATUSES,
  RESEARCH_PRIORITIES,
} from "@/lib/research/types";

type IdeaDetailManagerProps = {
  idea: InvestmentIdea;
  companyName: string;
  instrumentId: string;
  linkedThesis: InvestmentThesis | null;
  currentThesisForCompany: InvestmentThesis | null;
  reviewEvents: ResearchReviewEvent[];
};

export function IdeaDetailManager({
  idea,
  companyName,
  instrumentId,
  linkedThesis,
  currentThesisForCompany,
  reviewEvents,
}: Readonly<IdeaDetailManagerProps>) {
  const [editing, setEditing] = useState(false);
  const router = useRouter();
  const [linkPending, setLinkPending] = useState(false);

  async function linkCurrentThesis() {
    if (!currentThesisForCompany) {
      return;
    }
    setLinkPending(true);
    const formData = new FormData();
    formData.set("ideaId", idea.id);
    formData.set("title", idea.title);
    formData.set("priority", idea.priority);
    formData.set("origin", idea.origin ?? "");
    formData.set("rationale", idea.rationale ?? "");
    formData.set("riskNotes", idea.riskNotes ?? "");
    formData.set("nextReviewDate", idea.nextReviewDate ?? "");
    formData.set("thesisId", currentThesisForCompany.id);
    formData.set("status", idea.status);
    await updateInvestmentIdeaAction({ status: "idle" }, formData);
    setLinkPending(false);
    router.refresh();
  }

  if (editing) {
    return <IdeaForm idea={idea} onDone={() => setEditing(false)} />;
  }

  const canOfferThesisLink = !idea.thesisId && currentThesisForCompany !== null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-foreground">
              {idea.title}
            </h2>
            <Badge variant={IDEA_STATUS_VARIANTS[idea.status]}>
              {IDEA_STATUS_LABELS[idea.status]}
            </Badge>
            <Badge variant={PRIORITY_VARIANTS[idea.priority]}>
              {PRIORITY_LABELS[idea.priority]}
            </Badge>
          </div>
          <Link
            href={`/app/research/companies/${instrumentId}`}
            className="text-sm text-primary hover:underline"
          >
            {companyName}
          </Link>
        </div>
        <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
          <Pencil aria-hidden="true" className="size-4" />
          Edit
        </Button>
      </div>

      {idea.status === "approved_for_manual_action" ? (
        <p className="rounded-lg border border-warning/30 bg-warning-surface px-4 py-3 text-sm text-warning">
          This is a personal research record only — it has not placed any trade
          or created an investment activity. PENRA never executes orders.
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {idea.origin ? <InfoCard label="Origin" value={idea.origin} /> : null}
        {idea.nextReviewDate ? (
          <InfoCard label="Next review date" value={idea.nextReviewDate} />
        ) : null}
      </div>

      {idea.rationale ? (
        <Card>
          <CardContent className="flex flex-col gap-1 p-4">
            <p className="text-sm font-medium text-foreground">Rationale</p>
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">
              {idea.rationale}
            </p>
          </CardContent>
        </Card>
      ) : null}

      {idea.riskNotes ? (
        <Card>
          <CardContent className="flex flex-col gap-1 p-4">
            <p className="text-sm font-medium text-foreground">Risk notes</p>
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">
              {idea.riskNotes}
            </p>
          </CardContent>
        </Card>
      ) : null}

      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-foreground">Linked thesis</p>
        {linkedThesis ? (
          <Link
            href={`/app/research/companies/${instrumentId}/thesis`}
            className="text-sm text-primary hover:underline"
          >
            {linkedThesis.title}
          </Link>
        ) : canOfferThesisLink ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-fit"
            isLoading={linkPending}
            onClick={() => void linkCurrentThesis()}
          >
            Link this company&apos;s current thesis
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground">No thesis linked yet.</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-foreground">Decision log</p>
        {reviewEvents.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No history recorded yet.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {reviewEvents.map((event) => (
              <li
                key={event.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-border bg-elevated px-3 py-2 text-sm"
              >
                <span className="text-foreground">
                  {event.summary ?? event.eventType}
                </span>
                <span className="text-xs text-muted-foreground">
                  {event.occurredAt.slice(0, 10)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function InfoCard({
  label,
  value,
}: Readonly<{ label: string; value: string }>) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-0.5 p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium text-foreground">{value}</p>
      </CardContent>
    </Card>
  );
}

function IdeaForm({
  idea,
  onDone,
}: Readonly<{ idea: InvestmentIdea; onDone: () => void }>) {
  const [state, formAction] = useActionState(
    updateInvestmentIdeaAction,
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
      <input type="hidden" name="ideaId" value={idea.id} />
      <input type="hidden" name="thesisId" value={idea.thesisId ?? ""} />
      <Field
        id="edit-idea-title"
        name="title"
        label="Title"
        required
        defaultValue={idea.title}
        error={fieldError("title")}
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Select
          id="edit-idea-priority"
          name="priority"
          label="Priority"
          defaultValue={idea.priority}
          options={RESEARCH_PRIORITIES.map((p) => ({
            value: p,
            label: PRIORITY_LABELS[p],
          }))}
        />
        <Select
          id="edit-idea-status"
          name="status"
          label="Status"
          defaultValue={idea.status}
          options={IDEA_STATUSES.map((s) => ({
            value: s,
            label: IDEA_STATUS_LABELS[s],
          }))}
        />
      </div>
      <Field
        id="edit-idea-origin"
        name="origin"
        label="Origin (optional)"
        defaultValue={idea.origin ?? ""}
      />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="edit-idea-rationale">Rationale (optional)</Label>
        <Textarea
          id="edit-idea-rationale"
          name="rationale"
          rows={3}
          defaultValue={idea.rationale ?? ""}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="edit-idea-risk-notes">Risk notes (optional)</Label>
        <Textarea
          id="edit-idea-risk-notes"
          name="riskNotes"
          rows={3}
          defaultValue={idea.riskNotes ?? ""}
        />
      </div>
      <Field
        id="edit-idea-next-review-date"
        name="nextReviewDate"
        label="Next review date (optional)"
        type="date"
        defaultValue={idea.nextReviewDate ?? ""}
        error={fieldError("nextReviewDate")}
      />
      {state.status === "error" ? (
        <FormMessage message={state.message} tone="error" />
      ) : null}
      <SubmitButton pendingText="Saving…">Save changes</SubmitButton>
    </form>
  );
}
