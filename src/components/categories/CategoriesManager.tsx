"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/Dialog";
import { Field } from "@/components/ui/Field";
import { FormMessage } from "@/components/ui/FormMessage";
import { Select } from "@/components/ui/Select";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { INITIAL_CATEGORY_ACTION_STATE } from "@/lib/categories/action-state";
import {
  createCategoryAction,
  setCategoryArchivedAction,
} from "@/lib/categories/actions";
import {
  CATEGORY_COLOR_OPTIONS,
  CATEGORY_ICON_OPTIONS,
} from "@/lib/categories/schema";
import type { Category } from "@/lib/categories/mapping";
import type { CategoryType } from "@/lib/categories/types";

type CategoriesManagerProps = {
  incomeCategories: Category[];
  expenseCategories: Category[];
};

export function CategoriesManager({
  incomeCategories,
  expenseCategories,
}: Readonly<CategoriesManagerProps>) {
  const [type, setType] = useState<CategoryType>("expense");
  const [createOpen, setCreateOpen] = useState(false);
  const categories = type === "income" ? incomeCategories : expenseCategories;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <SegmentedControl
          label="Category type"
          value={type}
          onChange={setType}
          options={[
            { value: "expense", label: "Expense" },
            { value: "income", label: "Income" },
          ]}
        />
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm">New category</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New {type} category</DialogTitle>
            </DialogHeader>
            <CreateCategoryForm
              categoryType={type}
              onDone={() => setCreateOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      <ul className="flex flex-col gap-2">
        {categories.map((category) => (
          <li key={category.id}>
            <Card>
              <CardContent className="flex items-center justify-between gap-3 p-4">
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="size-3 shrink-0 rounded-full border border-border"
                    style={{ backgroundColor: category.color ?? "transparent" }}
                  />
                  <span className="truncate font-medium text-foreground">
                    {category.name}
                  </span>
                  {category.isSystem ? (
                    <Badge variant="neutral">Default</Badge>
                  ) : category.isArchived ? (
                    <Badge variant="neutral">Archived</Badge>
                  ) : null}
                </div>
                {!category.isSystem ? (
                  <ArchiveToggleButton category={category} />
                ) : null}
              </CardContent>
            </Card>
          </li>
        ))}
        {categories.length === 0 ? (
          <p className="px-1 py-4 text-sm text-muted-foreground">
            No {type} categories yet.
          </p>
        ) : null}
      </ul>
    </div>
  );
}

function ArchiveToggleButton({ category }: Readonly<{ category: Category }>) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function toggle() {
    setPending(true);
    const formData = new FormData();
    formData.set("categoryId", category.id);
    formData.set("isArchived", String(!category.isArchived));
    await setCategoryArchivedAction({ status: "idle" }, formData);
    setPending(false);
    router.refresh();
  }

  if (category.isArchived) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        isLoading={pending}
        onClick={() => void toggle()}
      >
        Restore
      </Button>
    );
  }

  return (
    <ConfirmDialog
      trigger={
        <Button type="button" variant="outline" size="sm">
          Archive
        </Button>
      }
      title={`Archive "${category.name}"?`}
      description="Past transactions keep this category. You won't be able to pick it for new transactions until you restore it."
      confirmLabel="Archive category"
      onConfirm={toggle}
      isConfirming={pending}
    />
  );
}

function CreateCategoryForm({
  categoryType,
  onDone,
}: Readonly<{ categoryType: CategoryType; onDone: () => void }>) {
  const [state, formAction] = useActionState(
    createCategoryAction,
    INITIAL_CATEGORY_ACTION_STATE,
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
      <input type="hidden" name="categoryType" value={categoryType} />
      <Field
        id="new-category-name"
        name="name"
        label="Name"
        required
        error={fieldError("name")}
      />
      <Select
        id="new-category-icon"
        name="icon"
        label="Icon (optional)"
        placeholder="No icon"
        options={CATEGORY_ICON_OPTIONS.map((icon) => ({
          value: icon,
          label: icon.replace(/-/g, " "),
        }))}
        error={fieldError("icon")}
      />
      <Select
        id="new-category-color"
        name="color"
        label="Colour (optional)"
        placeholder="No colour"
        options={CATEGORY_COLOR_OPTIONS.map((color) => ({
          value: color,
          label: color,
        }))}
        error={fieldError("color")}
      />
      {state.status === "error" ? (
        <FormMessage message={state.message} tone="error" />
      ) : null}
      <SubmitButton pendingText="Creating…">Create category</SubmitButton>
    </form>
  );
}
