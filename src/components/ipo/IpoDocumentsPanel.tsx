"use client";

import { ExternalLink, FileText, PlusCircle, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";

import { AddIpoDocumentForm } from "@/components/ipo/AddIpoDocumentForm";
import { AddSourceExcerptForm } from "@/components/ai/AddSourceExcerptForm";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/Dialog";
import type { SourceDocumentChunk } from "@/lib/ai/mapping";
import type { IpoDocument } from "@/lib/ipo/mapping";
import { IPO_DOCUMENT_TYPE_LABELS } from "@/lib/ipo/types";

type IpoDocumentsPanelProps = {
  ipoIssueId: string;
  documents: IpoDocument[];
  chunks: SourceDocumentChunk[];
};

export function IpoDocumentsPanel({
  ipoIssueId,
  documents,
  chunks,
}: Readonly<IpoDocumentsPanelProps>) {
  const [addOpen, setAddOpen] = useState(false);
  const [excerptDocId, setExcerptDocId] = useState<string | null>(null);
  const chunkCountByDocument = useMemo(() => {
    const counts = new Map<string, number>();
    for (const chunk of chunks) {
      if (!chunk.ipoDocumentId) {
        continue;
      }
      counts.set(
        chunk.ipoDocumentId,
        (counts.get(chunk.ipoDocumentId) ?? 0) + 1,
      );
    }
    return counts;
  }, [chunks]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          DRHP/RHP/prospectus/corrigendum links from official sources only.
        </p>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <PlusCircle aria-hidden="true" className="size-4" />
              Add document
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add an official document link</DialogTitle>
            </DialogHeader>
            <AddIpoDocumentForm
              ipoIssueId={ipoIssueId}
              onDone={() => setAddOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      {documents.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No documents linked yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {documents.map((doc) => (
            <li key={doc.id}>
              <Card>
                <CardContent className="flex flex-col gap-2 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-foreground">{doc.title}</p>
                    <div className="flex items-center gap-2">
                      {doc.isVerified ? (
                        <Badge variant="positive">
                          <ShieldCheck aria-hidden="true" className="size-3" />
                          Verified
                        </Badge>
                      ) : null}
                      <Badge variant="neutral">
                        {IPO_DOCUMENT_TYPE_LABELS[doc.documentType]}
                      </Badge>
                    </div>
                  </div>
                  <a
                    href={doc.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="flex w-fit items-center gap-1.5 text-sm text-primary hover:underline"
                  >
                    Open document
                    <ExternalLink aria-hidden="true" className="size-3.5" />
                  </a>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-muted-foreground">
                      {doc.filingDate ? `Filed ${doc.filingDate} · ` : ""}
                      Added {doc.createdAt.slice(0, 10)}
                    </p>
                    <Dialog
                      open={excerptDocId === doc.id}
                      onOpenChange={(open) =>
                        setExcerptDocId(open ? doc.id : null)
                      }
                    >
                      <DialogTrigger asChild>
                        <Button type="button" variant="ghost" size="sm">
                          <FileText aria-hidden="true" className="size-3.5" />
                          {chunkCountByDocument.get(doc.id) ?? 0} excerpt
                          {(chunkCountByDocument.get(doc.id) ?? 0) === 1
                            ? ""
                            : "s"}{" "}
                          · Add
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>
                            Transcribe an excerpt from &quot;{doc.title}&quot;
                          </DialogTitle>
                        </DialogHeader>
                        <AddSourceExcerptForm
                          ipoDocumentId={doc.id}
                          onDone={() => setExcerptDocId(null)}
                        />
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
