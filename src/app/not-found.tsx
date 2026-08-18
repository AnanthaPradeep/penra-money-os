import { FileQuestion } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

export default function RootNotFound() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-16">
      <EmptyState
        icon={<FileQuestion aria-hidden="true" className="size-6" />}
        title="Page not found"
        description="The page you're looking for doesn't exist or may have moved."
        action={
          <Button asChild variant="outline">
            <Link href="/">Back to home</Link>
          </Button>
        }
      />
    </main>
  );
}
