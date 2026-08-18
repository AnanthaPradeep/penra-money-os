"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Field } from "@/components/ui/Field";
import { FormMessage } from "@/components/ui/FormMessage";
import { Select } from "@/components/ui/Select";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { INITIAL_INSTITUTION_ACTION_STATE } from "@/lib/institutions/action-state";
import { createInstitutionAction } from "@/lib/institutions/actions";
import {
  INSTITUTION_TYPES,
  INSTITUTION_TYPE_LABELS,
} from "@/lib/institutions/types";

const INSTITUTION_TYPE_OPTIONS = INSTITUTION_TYPES.map((type) => ({
  value: type,
  label: INSTITUTION_TYPE_LABELS[type],
}));

/**
 * A collapsed-by-default inline form so adding an institution never
 * requires leaving the account-creation flow. Calls router.refresh() only
 * after a confirmed successful create (never optimistically) so the
 * parent Server Component's institution list — and this form's own
 * select — picks up the new row.
 */
export function AddInstitutionForm() {
  const [state, formAction] = useActionState(
    createInstitutionAction,
    INITIAL_INSTITUTION_ACTION_STATE,
  );
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (state.status === "success") {
      router.refresh();
    }
  }, [state, router]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-left text-sm underline underline-offset-2"
      >
        + Add a new institution
      </button>
    );
  }

  const fieldError = (name: string) =>
    state.status === "error" ? state.fieldErrors?.[name] : undefined;

  return (
    <div className="flex flex-col gap-4 rounded-md border border-current/15 p-4">
      <form action={formAction} noValidate className="flex flex-col gap-4">
        <Field
          id="new-institution-name"
          name="name"
          label="Institution name"
          required
          error={fieldError("name")}
        />
        <Select
          id="new-institution-type"
          name="institutionType"
          label="Type"
          options={INSTITUTION_TYPE_OPTIONS}
          defaultValue="bank"
          required
          error={fieldError("institutionType")}
        />

        {state.status !== "idle" ? (
          <FormMessage
            message={state.message}
            tone={state.status === "success" ? "success" : "error"}
          />
        ) : null}

        <div className="flex gap-2">
          <SubmitButton pendingText="Adding…">Add institution</SubmitButton>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-md border border-current/25 px-4 py-2 text-sm"
          >
            {state.status === "success" ? "Done" : "Cancel"}
          </button>
        </div>
      </form>
    </div>
  );
}
