import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { redirect } from "next/navigation";

import { ProfileForm } from "@/components/profile/ProfileForm";
import { ThemePreference } from "@/components/theme/ThemePreference";
import { BackLink } from "@/components/ui/BackLink";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { PageHeader } from "@/components/ui/PageHeader";
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
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <PageHeader
        eyebrow={<BackLink href="/app">Back to home</BackLink>}
        title="Profile settings"
      />

      <Card>
        <CardHeader>
          <CardTitle>Your details</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {user.email ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="profile-email">Email</Label>
              <Input id="profile-email" value={user.email} readOnly disabled />
            </div>
          ) : null}
          <ProfileForm profile={profile} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
        </CardHeader>
        <CardContent>
          <ThemePreference />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Link
            href="/app/settings/market-data"
            className="flex items-center justify-between gap-3 p-4 hover:bg-muted-surface"
          >
            <div className="flex flex-col gap-0.5">
              <span className="font-medium text-foreground">Market data</span>
              <span className="text-sm text-muted-foreground">
                Provider status, linked holdings, and manual refresh
              </span>
            </div>
            <ChevronRight
              aria-hidden="true"
              className="size-4 shrink-0 text-muted-foreground"
            />
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
