import { redirect } from "next/navigation";

import { nowAsIstCalendarDate } from "@/lib/dates/timezone";

/** Redirects to the current calendar month — /app/budgets/[month] is the real page. */
export default function BudgetsRedirectPage() {
  const currentMonth = nowAsIstCalendarDate().slice(0, 7);
  redirect(`/app/budgets/${currentMonth}`);
}
