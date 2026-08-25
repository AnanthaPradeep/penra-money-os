import Link from "next/link";

import { AI_JOB_STATUS_VARIANTS } from "@/components/ai/statusVariants";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent } from "@/components/ui/Card";
import type { AiJob } from "@/lib/ai/mapping";
import { AI_JOB_KIND_LABELS, AI_JOB_STATUS_LABELS } from "@/lib/ai/types";

type AiJobsListProps = {
  jobs: AiJob[];
};

export function AiJobsList({ jobs }: Readonly<AiJobsListProps>) {
  if (jobs.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No AI requests yet. Ask something from the research assistant.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {jobs.map((job) => (
        <li key={job.id}>
          <Link href={`/app/research/ai-jobs/${job.id}`}>
            <Card className="transition-colors hover:border-primary/40">
              <CardContent className="flex items-center justify-between gap-3 p-4">
                <div className="flex min-w-0 flex-col gap-1">
                  <p className="truncate font-medium text-foreground">
                    {AI_JOB_KIND_LABELS[job.jobKind]}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {job.requestedAt.slice(0, 10)}
                    {job.questionText ? ` · "${job.questionText}"` : ""}
                  </p>
                </div>
                <Badge variant={AI_JOB_STATUS_VARIANTS[job.status]}>
                  {AI_JOB_STATUS_LABELS[job.status]}
                </Badge>
              </CardContent>
            </Card>
          </Link>
        </li>
      ))}
    </ul>
  );
}
