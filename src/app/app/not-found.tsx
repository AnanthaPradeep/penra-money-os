import { FileQuestion } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

/**
 * Shown for any /app route calling notFound() (e.g. an account or
 * transaction id that doesn't exist, belongs to someone else, or is a
 * hidden system account) — deliberately generic. It never distinguishes
 * "doesn't exist" from "isn't yours", which would leak which ids are
 * real to anyone probing URLs.
 */
export default function AppNotFound() {
  return (
    <EmptyState
      icon={<FileQuestion aria-hidden="true" className="size-6" />}
      title="We couldn't find that"
      description="It may have been removed, or the link may be incorrect."
      action={
        <Button asChild variant="outline">
          <Link href="/app">Back to home</Link>
        </Button>
      }
    />
  );
}
