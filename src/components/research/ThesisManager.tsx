"use client";

import { Lightbulb, Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field } from "@/components/ui/Field";
import { FormMessage } from "@/components/ui/FormMessage";
import { Label } from "@/components/ui/Label";
import { Select } from "@/components/ui/Select";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { Textarea } from "@/components/ui/Textarea";
import { THESIS_STATUS_VARIANTS } from "@/components/research/statusVariants";
import { INITIAL_RESEARCH_ACTION_STATE } from "@/lib/research/action-state";
import {
  createInvestmentThesisAction,
  updateInvestmentThesisAction,
} from "@/lib/research/actions";
import type {
  InvestmentThesis,
  InvestmentThesisVersion,
} from "@/lib/research/mapping";
import {
  CONFIDENCE_LEVELS,
  THESIS_STATUS_LABELS,
  THESIS_STATUSES,
  TIME_HORIZON_LABELS,
  TIME_HORIZONS,
} from "@/lib/research/types";

type ThesisManagerProps = {
  instrumentId: string;
  thesis: InvestmentThesis | null;
  versions: InvestmentThesisVersion[];
};

export function ThesisManager({
  instrumentId,
  thesis,
  versions,
}: Readonly<ThesisManagerProps>) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <div className="flex flex-col gap-4">
        {thesis ? (
          <p className="text-sm text-muted-foreground">
            Saving records a brand-new version — nothing here is ever silently
            overwritten.
          </p>
        ) : null}
        <ThesisForm
          instrumentId={instrumentId}
          thesis={thesis}
          onDone={() => setEditing(false)}
        />
      </div>
    );
  }

  if (!thesis) {
    return (
      <EmptyState
        icon={<Lightbulb aria-hidden="true" className="size-6" />}
        title="No thesis yet"
        description="Capture the investment case, opportunities, risks, catalysts, and what would invalidate it — a private research record, never a buy/sell instruction."
        action={<Button onClick={() => setEditing(true)}>Create thesis</Button>}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-foreground">
              {thesis.title}
            </h3>
            <Badge variant={THESIS_STATUS_VARIANTS[thesis.status]}>
              {THESIS_STATUS_LABELS[thesis.status]}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Version {thesis.currentVersion} ·{" "}
            {TIME_HORIZON_LABELS[thesis.timeHorizon]} · {thesis.confidence}{" "}
            confidence (a qualitative level, not a probability)
            {thesis.expectedReviewDate
              ? ` · review by ${thesis.expectedReviewDate}`
              : ""}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
          <Pencil aria-hidden="true" className="size-4" />
          Edit
        </Button>
      </div>

      <div className="flex flex-col gap-4">
        {(
          [
            ["summary", "Summary"],
            ["investmentCase", "Investment case"],
            ["opportunities", "Opportunities"],
            ["risks", "Risks"],
            ["catalysts", "Catalysts"],
            ["invalidationConditions", "Invalidation conditions"],
          ] as const
        ).map(([key, label]) =>
          thesis[key] ? (
            <Card key={key}>
              <CardContent className="flex flex-col gap-1 p-4">
                <p className="text-sm font-medium text-foreground">{label}</p>
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                  {thesis[key]}
                </p>
              </CardContent>
            </Card>
          ) : null,
        )}
      </div>

      {versions.length > 1 ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-foreground">Version history</p>
          <ul className="flex flex-col gap-2">
            {versions.map((version) => (
              <li key={version.id}>
                <Card>
                  <CardContent className="flex items-center justify-between gap-3 p-3 text-sm">
                    <span className="text-foreground">
                      Version {version.version} — {version.title}
                    </span>
                    <span className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant={THESIS_STATUS_VARIANTS[version.status]}>
                        {THESIS_STATUS_LABELS[version.status]}
                      </Badge>
                      {version.createdAt.slice(0, 10)}
                    </span>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function ThesisForm({
  instrumentId,
  thesis,
  onDone,
}: Readonly<{
  instrumentId: string;
  thesis: InvestmentThesis | null;
  onDone: () => void;
}>) {
  const action = thesis
    ? updateInvestmentThesisAction
    : createInvestmentThesisAction;
  const [state, formAction] = useActionState(
    action,
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
      {thesis ? (
        <input type="hidden" name="thesisId" value={thesis.id} />
      ) : (
        <input type="hidden" name="instrumentId" value={instrumentId} />
      )}
      <Field
        id="thesis-title"
        name="title"
        label="Title"
        required
        defaultValue={thesis?.title}
        error={fieldError("title")}
      />
      <TextareaField
        id="thesis-summary"
        name="summary"
        label="Summary"
        defaultValue={thesis?.summary}
      />
      <TextareaField
        id="thesis-investment-case"
        name="investmentCase"
        label="Investment case"
        defaultValue={thesis?.investmentCase}
        rows={4}
      />
      <TextareaField
        id="thesis-opportunities"
        name="opportunities"
        label="Opportunities"
        defaultValue={thesis?.opportunities}
      />
      <TextareaField
        id="thesis-risks"
        name="risks"
        label="Risks"
        defaultValue={thesis?.risks}
      />
      <TextareaField
        id="thesis-catalysts"
        name="catalysts"
        label="Catalysts"
        defaultValue={thesis?.catalysts}
      />
      <TextareaField
        id="thesis-invalidation"
        name="invalidationConditions"
        label="Invalidation conditions"
        defaultValue={thesis?.invalidationConditions}
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Select
          id="thesis-time-horizon"
          name="timeHorizon"
          label="Time horizon"
          defaultValue={thesis?.timeHorizon ?? "medium_term"}
          options={TIME_HORIZONS.map((h) => ({
            value: h,
            label: TIME_HORIZON_LABELS[h],
          }))}
        />
        <Select
          id="thesis-confidence"
          name="confidence"
          label="Confidence (qualitative)"
          defaultValue={thesis?.confidence ?? "medium"}
          options={CONFIDENCE_LEVELS.map((c) => ({
            value: c,
            label: c,
          }))}
        />
        <Select
          id="thesis-status"
          name="status"
          label="Status"
          defaultValue={thesis?.status ?? "draft"}
          options={THESIS_STATUSES.map((s) => ({
            value: s,
            label: THESIS_STATUS_LABELS[s],
          }))}
        />
      </div>
      <Field
        id="thesis-review-date"
        name="expectedReviewDate"
        label="Expected review date (optional)"
        type="date"
        defaultValue={thesis?.expectedReviewDate ?? ""}
        error={fieldError("expectedReviewDate")}
      />
      {state.status === "error" ? (
        <FormMessage message={state.message} tone="error" />
      ) : null}
      <SubmitButton pendingText="Saving…">
        {thesis ? "Save new version" : "Create thesis"}
      </SubmitButton>
    </form>
  );
}

function TextareaField({
  id,
  name,
  label,
  defaultValue,
  rows = 3,
}: Readonly<{
  id: string;
  name: string;
  label: string;
  defaultValue?: string | null | undefined;
  rows?: number;
}>) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Textarea
        id={id}
        name={name}
        rows={rows}
        defaultValue={defaultValue ?? ""}
      />
    </div>
  );
}
