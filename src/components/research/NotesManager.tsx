"use client";

import {
  Archive,
  ExternalLink,
  Pencil,
  Pin,
  PlusCircle,
  RotateCcw,
} from "lucide-react";
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
import { IconButton } from "@/components/ui/IconButton";
import { Label } from "@/components/ui/Label";
import { Select } from "@/components/ui/Select";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { Textarea } from "@/components/ui/Textarea";
import { INITIAL_RESEARCH_ACTION_STATE } from "@/lib/research/action-state";
import {
  createResearchNoteAction,
  updateResearchNoteAction,
} from "@/lib/research/actions";
import type { ResearchNote } from "@/lib/research/mapping";
import { NOTE_TYPES, NOTE_TYPE_LABELS } from "@/lib/research/types";

type NotesManagerProps = {
  instrumentId: string;
  notes: ResearchNote[];
};

export function NotesManager({
  instrumentId,
  notes,
}: Readonly<NotesManagerProps>) {
  const [createOpen, setCreateOpen] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const visibleNotes = notes.filter((n) => n.isArchived === showArchived);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setShowArchived((v) => !v)}
        >
          {showArchived ? "Show active notes" : "Show archived notes"}
        </Button>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <PlusCircle aria-hidden="true" className="size-4" />
              New note
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New research note</DialogTitle>
            </DialogHeader>
            <NoteForm
              instrumentId={instrumentId}
              onDone={() => setCreateOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      {visibleNotes.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {showArchived ? "No archived notes." : "No notes yet."}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {visibleNotes.map((note) => (
            <li key={note.id}>
              <NoteCard note={note} instrumentId={instrumentId} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function NoteCard({
  note,
  instrumentId,
}: Readonly<{ note: ResearchNote; instrumentId: string }>) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [togglePending, setTogglePending] = useState(false);

  async function togglePinned() {
    setTogglePending(true);
    const formData = new FormData();
    formData.set("noteId", note.id);
    formData.set("title", note.title);
    formData.set("body", note.body);
    formData.set("noteType", note.noteType);
    formData.set("sourceUrl", note.sourceUrl ?? "");
    formData.set("filingId", note.filingId ?? "");
    formData.set("observedDate", note.observedDate ?? "");
    formData.set("isPinned", String(!note.isPinned));
    formData.set("isArchived", String(note.isArchived));
    await updateResearchNoteAction({ status: "idle" }, formData);
    setTogglePending(false);
    router.refresh();
  }

  async function toggleArchived() {
    setTogglePending(true);
    const formData = new FormData();
    formData.set("noteId", note.id);
    formData.set("title", note.title);
    formData.set("body", note.body);
    formData.set("noteType", note.noteType);
    formData.set("sourceUrl", note.sourceUrl ?? "");
    formData.set("filingId", note.filingId ?? "");
    formData.set("observedDate", note.observedDate ?? "");
    formData.set("isPinned", String(note.isPinned));
    formData.set("isArchived", String(!note.isArchived));
    await updateResearchNoteAction({ status: "idle" }, formData);
    setTogglePending(false);
    router.refresh();
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            {note.isPinned ? (
              <Pin
                aria-hidden="true"
                className="size-3.5 shrink-0 text-primary"
              />
            ) : null}
            <p className="truncate font-medium text-foreground">{note.title}</p>
          </div>
          <Badge variant="neutral">{NOTE_TYPE_LABELS[note.noteType]}</Badge>
        </div>
        <p className="whitespace-pre-wrap text-sm text-muted-foreground">
          {note.body}
        </p>
        {note.sourceUrl ? (
          <a
            href={note.sourceUrl}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="flex w-fit items-center gap-1.5 text-sm text-primary hover:underline"
          >
            Source <ExternalLink aria-hidden="true" className="size-3.5" />
          </a>
        ) : null}
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>
            {note.observedDate ? `Observed ${note.observedDate} · ` : ""}
            Updated {note.updatedAt.slice(0, 10)}
          </span>
          <div className="flex items-center gap-1">
            <IconButton
              icon={<Pin aria-hidden="true" className="size-4" />}
              aria-label={note.isPinned ? "Unpin note" : "Pin note"}
              disabled={togglePending}
              onClick={() => void togglePinned()}
            />
            <Dialog open={editOpen} onOpenChange={setEditOpen}>
              <DialogTrigger asChild>
                <IconButton
                  icon={<Pencil aria-hidden="true" className="size-4" />}
                  aria-label="Edit note"
                />
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Edit note</DialogTitle>
                </DialogHeader>
                <NoteForm
                  instrumentId={instrumentId}
                  note={note}
                  onDone={() => setEditOpen(false)}
                />
              </DialogContent>
            </Dialog>
            <IconButton
              icon={
                note.isArchived ? (
                  <RotateCcw aria-hidden="true" className="size-4" />
                ) : (
                  <Archive aria-hidden="true" className="size-4" />
                )
              }
              aria-label={note.isArchived ? "Restore note" : "Archive note"}
              disabled={togglePending}
              onClick={() => void toggleArchived()}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function NoteForm({
  instrumentId,
  note,
  onDone,
}: Readonly<{
  instrumentId: string;
  note?: ResearchNote;
  onDone: () => void;
}>) {
  const action = note ? updateResearchNoteAction : createResearchNoteAction;
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
      {note ? (
        <>
          <input type="hidden" name="noteId" value={note.id} />
          <input type="hidden" name="isPinned" value={String(note.isPinned)} />
          <input
            type="hidden"
            name="isArchived"
            value={String(note.isArchived)}
          />
        </>
      ) : (
        <input type="hidden" name="instrumentId" value={instrumentId} />
      )}
      <Field
        id="note-title"
        name="title"
        label="Title"
        required
        defaultValue={note?.title}
        error={fieldError("title")}
      />
      <Select
        id="note-type"
        name="noteType"
        label="Type"
        defaultValue={note?.noteType ?? "general"}
        options={NOTE_TYPES.map((type) => ({
          value: type,
          label: NOTE_TYPE_LABELS[type],
        }))}
      />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="note-body">Content</Label>
        <Textarea
          id="note-body"
          name="body"
          rows={5}
          required
          defaultValue={note?.body}
          aria-invalid={fieldError("body") ? true : undefined}
        />
        {fieldError("body") ? (
          <p role="alert" className="text-sm font-medium text-negative">
            {fieldError("body")}
          </p>
        ) : null}
      </div>
      <Field
        id="note-source-url"
        name="sourceUrl"
        label="Source URL (optional)"
        defaultValue={note?.sourceUrl ?? ""}
        error={fieldError("sourceUrl")}
      />
      <Field
        id="note-observed-date"
        name="observedDate"
        label="Observed date (optional)"
        type="date"
        defaultValue={note?.observedDate ?? ""}
        error={fieldError("observedDate")}
      />
      {state.status === "error" ? (
        <FormMessage message={state.message} tone="error" />
      ) : null}
      <SubmitButton pendingText="Saving…">
        {note ? "Save changes" : "Create note"}
      </SubmitButton>
    </form>
  );
}
