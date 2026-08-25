import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { AI_JOB_STATUS_VARIANTS } from "@/components/ai/statusVariants";
import { AiJobOutputSection } from "@/components/ai/AiJobOutputSection";
import { RejectAiJobButton } from "@/components/ai/RejectAiJobButton";
import { Badge } from "@/components/ui/Badge";
import { BackLink } from "@/components/ui/BackLink";
import { Card, CardContent } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { getAiJobById, listAiJobOutputs } from "@/lib/ai/queries";
import {
  AI_JOB_KIND_LABELS,
  AI_JOB_STATUS_LABELS,
  AI_PROVIDER_LABELS,
  AI_SECTION_TYPES,
} from "@/lib/ai/types";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type AiJobDetailPageProps = {
  params: Promise<{ jobId: string }>;
};

export const metadata: Metadata = {
  title: "AI request detail — PENRA Money OS",
};

const BLOCKED_REASON_MESSAGES: Record<string, string> = {
  provider_not_configured:
    "No AI provider was configured when this ran, so nothing was generated.",
  invalid_citation:
    "The model's answer cited a source it wasn't authorized to use, so nothing was saved.",
  provider_response_malformed:
    "The provider's response wasn't in the expected format, so nothing was saved.",
};

export default async function AiJobDetailPage({
  params,
}: Readonly<AiJobDetailPageProps>) {
  const { jobId } = await params;

  const user = await getAuthenticatedUser();
  if (!user) {
    redirect(`/login?next=/app/research/ai-jobs/${jobId}`);
  }

  const supabase = await createSupabaseServerClient();
  const job = await getAiJobById(supabase, jobId);
  if (!job) {
    notFound();
  }

  const outputs = await listAiJobOutputs(supabase, jobId);
  const outputsBySection = new Map(
    AI_SECTION_TYPES.map((key) => [
      key,
      outputs.filter((o) => o.sectionType === key),
    ]),
  );
  const allCitations = [...new Set(outputs.flatMap((o) => o.citations))];

  const blockedReasonKey = job.errorCode?.split(":")[0];
  const blockedMessage =
    blockedReasonKey && blockedReasonKey in BLOCKED_REASON_MESSAGES
      ? BLOCKED_REASON_MESSAGES[blockedReasonKey]
      : job.errorCode
        ? `This request could not be completed (${job.errorCode}).`
        : null;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow={<BackLink href="/app/research/ai-jobs">AI requests</BackLink>}
        title={AI_JOB_KIND_LABELS[job.jobKind]}
        {...(job.questionText ? { description: job.questionText } : {})}
        actions={
          <Badge variant={AI_JOB_STATUS_VARIANTS[job.status]}>
            {AI_JOB_STATUS_LABELS[job.status]}
          </Badge>
        }
      />

      {blockedMessage ? (
        <Card className="border-warning/30 bg-warning-surface">
          <CardContent className="p-4 text-sm text-warning">
            {blockedMessage}
          </CardContent>
        </Card>
      ) : null}

      <section aria-labelledby="meta-heading" className="flex flex-col gap-3">
        <SectionHeader id="meta-heading" title="Request details" />
        <Card>
          <CardContent className="p-4 text-sm">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
              <div>
                <dt className="text-muted-foreground">Provider</dt>
                <dd className="text-foreground">
                  {AI_PROVIDER_LABELS[job.provider]} · {job.modelId}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Requested</dt>
                <dd className="text-foreground">
                  {job.requestedAt.slice(0, 19).replace("T", " ")}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Tokens</dt>
                <dd className="text-foreground">
                  {job.inputTokens ?? "—"} in / {job.outputTokens ?? "—"} out
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Authorized sources</dt>
                <dd className="text-foreground">{allCitations.length}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Review status</dt>
                <dd className="text-foreground">
                  {job.humanReviewStatus ?? "Not yet reviewed"}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </section>

      {outputs.length > 0 ? (
        <section
          aria-labelledby="outputs-heading"
          className="flex flex-col gap-3"
        >
          <SectionHeader id="outputs-heading" title="Result" />
          {AI_SECTION_TYPES.map((sectionKey) => {
            const sectionOutputs = outputsBySection.get(sectionKey) ?? [];
            if (sectionOutputs.length === 0) {
              return null;
            }
            return (
              <div key={sectionKey} className="flex flex-col gap-2">
                {sectionOutputs.map((output) => (
                  <AiJobOutputSection key={output.id} output={output} />
                ))}
              </div>
            );
          })}
          {job.humanReviewStatus !== "rejected" ? (
            <RejectAiJobButton jobId={job.id} />
          ) : null}
        </section>
      ) : job.status === "completed" ? (
        <p className="text-sm text-muted-foreground">
          This request completed with no output sections.
        </p>
      ) : null}
    </div>
  );
}
