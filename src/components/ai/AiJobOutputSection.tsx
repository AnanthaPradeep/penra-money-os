"use client";

import { Check, Pencil } from "lucide-react";
import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { Textarea } from "@/components/ui/Textarea";
import { INITIAL_AI_ACTION_STATE } from "@/lib/ai/action-state";
import { acceptAiJobOutputAction } from "@/lib/ai/actions";
import type { AiJobOutput } from "@/lib/ai/mapping";
import { AI_SECTION_TYPE_LABELS } from "@/lib/ai/types";

type AiJobOutputSectionProps = {
  output: AiJobOutput;
};

/**
 * One AI-generated section, always shown with its citations beside it —
 * never rendered as fact without them. Human review is mandatory: nothing
 * here is saved to any research record until the user explicitly accepts
 * it (optionally editing the text first), matching outcome #17.
 */
export function AiJobOutputSection({
  output,
}: Readonly<AiJobOutputSectionProps>) {
  const [editing, setEditing] = useState(false);
  const [state, formAction] = useActionState(
    acceptAiJobOutputAction,
    INITIAL_AI_ACTION_STATE,
  );
  const router = useRouter();

  useEffect(() => {
    if (state.status === "success") {
      router.refresh();
    }
  }, [state, router]);

  // Once the server confirms acceptance, the edit form hides itself even
  // if local `editing` state hasn't been reset — avoids calling setState
  // synchronously inside the effect above just to close it.
  const showEditForm = editing && !output.accepted;

  return (
    <Card>
      <CardContent className="flex flex-col gap-2 p-4">
        <div className="flex items-center justify-between gap-2">
          <Badge variant="neutral">
            {AI_SECTION_TYPE_LABELS[output.sectionType]}
          </Badge>
          {output.accepted ? (
            <Badge variant="positive">
              <Check aria-hidden="true" className="size-3" />
              {output.isUserEdited ? "Accepted (edited)" : "Accepted"}
            </Badge>
          ) : null}
        </div>

        {showEditForm ? (
          <form action={formAction} className="flex flex-col gap-2">
            <input type="hidden" name="outputId" value={output.id} />
            <Textarea
              name="editedContent"
              rows={4}
              defaultValue={output.content}
            />
            <div className="flex gap-2">
              <SubmitButton pendingText="Saving…" className="w-fit">
                Save & accept
              </SubmitButton>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setEditing(false)}
              >
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <p className="whitespace-pre-wrap text-sm text-foreground">
            {output.content}
          </p>
        )}

        {output.citations.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {output.citations.map((citationId) => (
              <Badge key={citationId} variant="info">
                Source {citationId.slice(0, 8)}
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            No source citation for this section.
          </p>
        )}

        {!output.accepted && !editing ? (
          <div className="flex gap-2">
            <form action={formAction}>
              <input type="hidden" name="outputId" value={output.id} />
              <SubmitButton pendingText="Accepting…" className="w-fit">
                Accept
              </SubmitButton>
            </form>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setEditing(true)}
            >
              <Pencil aria-hidden="true" className="size-3.5" />
              Edit & accept
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
