"use client";

import { PlusCircle } from "lucide-react";
import { useState } from "react";

import { AddIpoForm } from "@/components/ipo/AddIpoForm";
import { IpoList } from "@/components/ipo/IpoList";
import { Button } from "@/components/ui/Button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/Dialog";
import { PageHeader } from "@/components/ui/PageHeader";
import type { IpoIssue, IpoWatchlistItem } from "@/lib/ipo/mapping";

type IposPageClientProps = {
  ipos: IpoIssue[];
  watchlistItems: IpoWatchlistItem[];
};

export function IposPageClient({
  ipos,
  watchlistItems,
}: Readonly<IposPageClientProps>) {
  const [addOpen, setAddOpen] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="IPOs"
        description="Track Indian IPOs through their public lifecycle from a verified official source. Nothing here can be used to apply to an IPO."
        actions={
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <PlusCircle aria-hidden="true" className="size-4" />
                Add IPO
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add an IPO from an official source</DialogTitle>
              </DialogHeader>
              <AddIpoForm onDone={() => setAddOpen(false)} />
            </DialogContent>
          </Dialog>
        }
      />
      <IpoList ipos={ipos} watchlistItems={watchlistItems} />
    </div>
  );
}
