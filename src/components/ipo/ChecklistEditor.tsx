"use client";

import { Plus, X } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import type { IpoChecklistItem } from "@/lib/ipo/types";

let nextClientId = 0;
function newChecklistId(): string {
  nextClientId += 1;
  return `client-${Date.now()}-${nextClientId}`;
}

type ChecklistEditorProps = {
  label: string;
  hiddenFieldName: string;
  initialItems: IpoChecklistItem[];
};

/**
 * A private, per-IPO checklist the caller edits freely (risk checklist /
 * source checklist) — kept as local React state and serialized into a
 * single hidden JSON field on submit, since it's a repeating add/remove/
 * check structure rather than a fixed set of named inputs. Server-side
 * validation (ipoResearchNoteSchema's checklistItemSchema) is the
 * authoritative check on the resulting shape.
 */
export function ChecklistEditor({
  label,
  hiddenFieldName,
  initialItems,
}: Readonly<ChecklistEditorProps>) {
  const [items, setItems] = useState<IpoChecklistItem[]>(initialItems);
  const [draft, setDraft] = useState("");

  function addItem() {
    const trimmed = draft.trim();
    if (!trimmed) {
      return;
    }
    setItems((prev) => [
      ...prev,
      { id: newChecklistId(), label: trimmed, checked: false },
    ]);
    setDraft("");
  }

  function toggleItem(id: string) {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, checked: !item.checked } : item,
      ),
    );
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        type="hidden"
        name={hiddenFieldName}
        value={JSON.stringify(items)}
      />
      <Label>{label}</Label>
      {items.length > 0 ? (
        <ul className="flex flex-col gap-1.5">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={item.checked}
                onChange={() => toggleItem(item.id)}
                aria-label={item.label}
                className="size-4 shrink-0 rounded border-input-border"
              />
              <span
                className={
                  item.checked
                    ? "flex-1 text-muted-foreground line-through"
                    : "flex-1 text-foreground"
                }
              >
                {item.label}
              </span>
              <button
                type="button"
                onClick={() => removeItem(item.id)}
                aria-label={`Remove "${item.label}"`}
                className="text-muted-foreground hover:text-negative"
              >
                <X aria-hidden="true" className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex items-center gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addItem();
            }
          }}
          placeholder="Add an item…"
          aria-label={`Add to ${label.toLowerCase()}`}
        />
        <Button type="button" variant="ghost" size="sm" onClick={addItem}>
          <Plus aria-hidden="true" className="size-4" />
          Add
        </Button>
      </div>
    </div>
  );
}
