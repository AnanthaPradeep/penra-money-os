"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";

import { ChecklistEditor } from "@/components/ipo/ChecklistEditor";
import { Badge } from "@/components/ui/Badge";
import { FormMessage } from "@/components/ui/FormMessage";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { TextareaField } from "@/components/ui/TextareaField";
import { INITIAL_IPO_ACTION_STATE } from "@/lib/ipo/action-state";
import { saveIpoResearchNoteAction } from "@/lib/ipo/actions";
import type { IpoResearchNote } from "@/lib/ipo/mapping";

type IpoResearchNoteFormProps = {
  ipoIssueId: string;
  note: IpoResearchNote | null;
};

const FIELDS: readonly { name: keyof IpoResearchNote; label: string }[] = [
  { name: "businessOverview", label: "Business overview" },
  { name: "revenueModel", label: "Revenue model" },
  { name: "industryContext", label: "Industry context" },
  { name: "promotersManagement", label: "Promoters & management" },
  { name: "useOfProceeds", label: "Use of proceeds" },
  { name: "strengths", label: "Strengths" },
  { name: "risks", label: "Risks" },
  { name: "materialLitigations", label: "Material litigations" },
  { name: "relatedPartyConcerns", label: "Related-party concerns" },
  { name: "concentrationRisk", label: "Concentration risk" },
  { name: "debtNotes", label: "Debt notes" },
  { name: "cashFlowNotes", label: "Cash flow notes" },
  { name: "dilutionNotes", label: "Dilution notes" },
  { name: "valuationObservations", label: "Valuation observations" },
  { name: "unansweredQuestions", label: "Unanswered questions" },
  { name: "personalNote", label: "Personal note" },
];

/**
 * Private, per-user structured research — never shared with other users
 * and never merged with AI output without explicit human review (see
 * isAiReviewedEdited/sourceAiJobId, surfaced but not editable here).
 */
export function IpoResearchNoteForm({
  ipoIssueId,
  note,
}: Readonly<IpoResearchNoteFormProps>) {
  const [state, formAction] = useActionState(
    saveIpoResearchNoteAction,
    INITIAL_IPO_ACTION_STATE,
  );
  const router = useRouter();

  useEffect(() => {
    if (state.status === "success") {
      router.refresh();
    }
  }, [state, router]);

  return (
    <form action={formAction} noValidate className="flex flex-col gap-5">
      <input type="hidden" name="ipoIssueId" value={ipoIssueId} />

      {note?.isAiReviewedEdited ? (
        <Badge variant="info" className="w-fit">
          Contains AI-assisted content you reviewed and accepted
        </Badge>
      ) : null}

      {FIELDS.map(({ name, label }) => (
        <TextareaField
          key={name}
          id={`ipo-research-${name}`}
          name={name}
          label={label}
          defaultValue={typeof note?.[name] === "string" ? note[name] : ""}
        />
      ))}

      <ChecklistEditor
        label="Risk checklist"
        hiddenFieldName="riskChecklist"
        initialItems={note?.riskChecklist ?? []}
      />
      <ChecklistEditor
        label="Source checklist"
        hiddenFieldName="sourceChecklist"
        initialItems={note?.sourceChecklist ?? []}
      />

      {state.status === "error" ? (
        <FormMessage message={state.message} tone="error" />
      ) : null}
      {state.status === "success" ? (
        <FormMessage message="Saved." tone="success" />
      ) : null}
      <SubmitButton pendingText="Saving…">Save research note</SubmitButton>
    </form>
  );
}
