import { redirect } from "next/navigation";

import { getAuthenticatedUser } from "@/lib/auth/session";
import { currentFinancialYear } from "@/lib/tax/financial-year";

export default async function TaxIndexPage() {
  const user = await getAuthenticatedUser();
  if (!user) {
    redirect("/login?next=/app/tax");
  }

  redirect(`/app/tax/${currentFinancialYear().id}`);
}
