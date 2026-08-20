import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { CategoriesManager } from "@/components/categories/CategoriesManager";
import { BackLink } from "@/components/ui/BackLink";
import { PageHeader } from "@/components/ui/PageHeader";
import { listCategories } from "@/lib/categories/queries";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Categories — PENRA Money OS",
};

export default async function CategoriesPage() {
  const user = await getAuthenticatedUser();
  if (!user) {
    redirect("/login?next=/app/categories");
  }

  const supabase = await createSupabaseServerClient();
  const [incomeCategories, expenseCategories] = await Promise.all([
    listCategories(supabase, "income"),
    listCategories(supabase, "expense"),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <PageHeader
        eyebrow={<BackLink href="/app">Back to home</BackLink>}
        title="Categories"
        description="Organise your income and expenses. Default categories are shared across every account and can't be renamed or removed, but you can add your own."
      />
      <CategoriesManager
        incomeCategories={incomeCategories}
        expenseCategories={expenseCategories}
      />
    </div>
  );
}
