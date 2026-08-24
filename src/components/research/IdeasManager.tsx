"use client";

import { Lightbulb, PlusCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";

import { StockInstrumentPicker } from "@/components/research/StockInstrumentPicker";
import {
  IDEA_STATUS_VARIANTS,
  PRIORITY_LABELS,
  PRIORITY_VARIANTS,
} from "@/components/research/statusVariants";
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
import { EmptyState } from "@/components/ui/EmptyState";
import { Field } from "@/components/ui/Field";
import { FormMessage } from "@/components/ui/FormMessage";
import { Label } from "@/components/ui/Label";
import { Select } from "@/components/ui/Select";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { Textarea } from "@/components/ui/Textarea";
import type { MarketInstrument } from "@/lib/market-data/mapping";
import { INITIAL_RESEARCH_ACTION_STATE } from "@/lib/research/action-state";
import { createInvestmentIdeaAction } from "@/lib/research/actions";
import type { InvestmentIdea } from "@/lib/research/mapping";
import {
  IDEA_STATUS_LABELS,
  IDEA_STATUSES,
  RESEARCH_PRIORITIES,
} from "@/lib/research/types";

type IdeasManagerProps = {
  ideas: InvestmentIdea[];
  instrumentsById: Record<string, MarketInstrument>;
};

export function IdeasManager({
  ideas,
  instrumentsById,
}: Readonly<IdeasManagerProps>) {
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-end">
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <PlusCircle aria-hidden="true" className="size-4" />
              New idea
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New investment idea</DialogTitle>
            </DialogHeader>
            <CreateIdeaForm onDone={() => setCreateOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      {ideas.length === 0 ? (
        <EmptyState
          icon={<Lightbulb aria-hidden="true" className="size-6" />}
          title="Capture your first idea"
          description="A private research record for an opportunity — owned, watchlist-only, or general. Ideas here never place a trade, even once approved for manual action."
          action={
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <PlusCircle aria-hidden="true" className="size-4" />
              New idea
            </Button>
          }
        />
      ) : (
        IDEA_STATUSES.map((status) => {
          const ideasInStatus = ideas.filter((i) => i.status === status);
          if (ideasInStatus.length === 0) {
            return null;
          }
          return (
            <section key={status} className="flex flex-col gap-3">
              <h2 className="flex items-center gap-2 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
                {IDEA_STATUS_LABELS[status]}
                <Badge variant="neutral">{ideasInStatus.length}</Badge>
              </h2>
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {ideasInStatus.map((idea) => (
                  <li key={idea.id}>
                    <Link href={`/app/research/ideas/${idea.id}`}>
                      <Card className="h-full transition-colors hover:border-input-border">
                        <CardContent className="flex flex-col gap-2 p-4">
                          <div className="flex items-start justify-between gap-2">
                            <p className="min-w-0 truncate font-medium text-foreground">
                              {idea.title}
                            </p>
                            <Badge variant={IDEA_STATUS_VARIANTS[idea.status]}>
                              {IDEA_STATUS_LABELS[idea.status]}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {instrumentsById[idea.instrumentId]?.name ??
                              "Unknown company"}
                          </p>
                          <div className="flex items-center gap-2">
                            <Badge variant={PRIORITY_VARIANTS[idea.priority]}>
                              {PRIORITY_LABELS[idea.priority]}
                            </Badge>
                            {idea.nextReviewDate ? (
                              <span className="text-xs text-muted-foreground">
                                Review by {idea.nextReviewDate}
                              </span>
                            ) : null}
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })
      )}
    </div>
  );
}

function CreateIdeaForm({ onDone }: Readonly<{ onDone: () => void }>) {
  const [state, formAction] = useActionState(
    createInvestmentIdeaAction,
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
      <StockInstrumentPicker name="instrumentId" label="Company" required />
      <Field
        id="idea-title"
        name="title"
        label="Title"
        required
        placeholder="e.g. Margin recovery play"
        error={fieldError("title")}
      />
      <Select
        id="idea-priority"
        name="priority"
        label="Priority"
        defaultValue="medium"
        options={RESEARCH_PRIORITIES.map((p) => ({
          value: p,
          label: PRIORITY_LABELS[p],
        }))}
      />
      <Field
        id="idea-origin"
        name="origin"
        label="Origin (optional)"
        placeholder="e.g. Screener, earnings call, news"
      />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="idea-rationale">Rationale (optional)</Label>
        <Textarea id="idea-rationale" name="rationale" rows={3} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="idea-risk-notes">Risk notes (optional)</Label>
        <Textarea id="idea-risk-notes" name="riskNotes" rows={3} />
      </div>
      <Field
        id="idea-next-review-date"
        name="nextReviewDate"
        label="Next review date (optional)"
        type="date"
        error={fieldError("nextReviewDate")}
      />
      {state.status === "error" ? (
        <FormMessage message={state.message} tone="error" />
      ) : null}
      <SubmitButton pendingText="Saving…">Capture idea</SubmitButton>
    </form>
  );
}
