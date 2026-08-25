import { CheckCircle2, XCircle } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/Badge";
import { Card, CardContent } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { getAiUsageToday, listAiProviderModels } from "@/lib/ai/queries";
import { AI_PROVIDER_LABELS } from "@/lib/ai/types";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { formatUSD } from "@/lib/money/format";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "AI settings — PENRA Money OS",
};

export default async function AiSettingsPage() {
  const user = await getAuthenticatedUser();
  if (!user) {
    redirect("/login?next=/app/settings/ai");
  }

  const supabase = await createSupabaseServerClient();
  const [models, usageToday] = await Promise.all([
    listAiProviderModels(supabase),
    getAiUsageToday(supabase),
  ]);

  const anyEnabled = models.some((m) => m.isEnabled);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="AI settings"
        description="Every AI job in this app goes through this registry — nothing is called that isn't listed and enabled here, and no provider credential is ever exposed to the browser."
      />

      {!anyEnabled ? (
        <Card className="border-warning/30 bg-warning-surface">
          <CardContent className="p-4 text-sm text-warning">
            No AI provider is configured in this environment. The research
            assistant and AI summaries are fully built but will not run until an
            administrator adds a provider API key and enables a model below.
          </CardContent>
        </Card>
      ) : null}

      <section
        aria-labelledby="providers-heading"
        className="flex flex-col gap-3"
      >
        <SectionHeader id="providers-heading" title="Provider models" />
        <ul className="flex flex-col gap-2">
          {models.map((model) => (
            <li key={model.id}>
              <Card>
                <CardContent className="flex items-center justify-between gap-3 p-4">
                  <div className="flex flex-col gap-1">
                    <p className="font-medium text-foreground">
                      {AI_PROVIDER_LABELS[model.provider]} · {model.modelId}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {model.maxInputTokens.toLocaleString()} input /{" "}
                      {model.perJobMaxOutputTokens.toLocaleString()} output
                      tokens per job · daily cap{" "}
                      {formatUSD(model.dailySpendCapUsd)}
                    </p>
                  </div>
                  {model.isEnabled ? (
                    <Badge variant="positive">
                      <CheckCircle2 aria-hidden="true" className="size-3" />
                      Enabled
                    </Badge>
                  ) : (
                    <Badge variant="neutral">
                      <XCircle aria-hidden="true" className="size-3" />
                      Not configured
                    </Badge>
                  )}
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="usage-heading" className="flex flex-col gap-3">
        <SectionHeader id="usage-heading" title="Your usage today" />
        {usageToday ? (
          <Card>
            <CardContent className="p-4 text-sm">
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
                <div>
                  <dt className="text-muted-foreground">Requests</dt>
                  <dd className="text-foreground">{usageToday.jobsCount}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Tokens</dt>
                  <dd className="text-foreground">
                    {usageToday.inputTokens.toLocaleString()} in /{" "}
                    {usageToday.outputTokens.toLocaleString()} out
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Estimated cost</dt>
                  <dd className="text-foreground">
                    {formatUSD(usageToday.estimatedCostUsd)}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        ) : (
          <p className="text-sm text-muted-foreground">
            No AI requests yet today.
          </p>
        )}
      </section>
    </div>
  );
}
