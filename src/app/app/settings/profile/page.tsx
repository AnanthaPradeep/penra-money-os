import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ProfileForm } from "@/components/profile/ProfileForm";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { getProfileForUser } from "@/lib/profile/queries";
import { PROFILE_DEFAULTS } from "@/lib/profile/schema";
import type { ProfileRow } from "@/lib/profile/types";

export const metadata: Metadata = {
  title: "Profile settings — PENRA Money OS",
};

export default async function ProfileSettingsPage() {
  const user = await getAuthenticatedUser();
  if (!user) {
    redirect("/login?next=/app/settings/profile");
  }

  const existingProfile = await getProfileForUser(user.id);

  // Falls back to the standard defaults if the row genuinely doesn't exist
  // yet (it always should, via the signup trigger — see
  // supabase/migrations) rather than showing a broken page.
  const profile: ProfileRow = existingProfile ?? {
    id: user.id,
    display_name: null,
    base_currency: PROFILE_DEFAULTS.baseCurrency,
    locale: PROFILE_DEFAULTS.locale,
    timezone: PROFILE_DEFAULTS.timezone,
    financial_year_start_month: PROFILE_DEFAULTS.financialYearStartMonth,
    created_at: new Date(0).toISOString(),
    updated_at: new Date(0).toISOString(),
  };

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-8 px-6 py-16">
      <header className="flex flex-col gap-2">
        <Link
          href="/app"
          className="text-sm font-medium opacity-80 underline underline-offset-2"
        >
          &larr; Back to PENRA Money OS
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">
          Profile settings
        </h1>
      </header>

      <ProfileForm profile={profile} />
    </main>
  );
}
