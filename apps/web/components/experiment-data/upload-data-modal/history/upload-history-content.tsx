"use client";

import type { UploadMetadata } from "@repo/api/schemas/experiment.schema";
import { ScrollArea } from "@repo/ui/components/scroll-area";

import { UploadHistoryCard } from "./upload-history-card";
import { UploadHistoryEmpty } from "./upload-history-empty";
import { UploadHistoryLoading } from "./upload-history-loading";

export interface UploadHistoryContentProps {
  isLoading: boolean;
  uploads: UploadMetadata[];
}

export function UploadHistoryContent({ isLoading, uploads }: UploadHistoryContentProps) {
  if (isLoading) {
    return <UploadHistoryLoading />;
  }

  if (uploads.length === 0) {
    return <UploadHistoryEmpty />;
  }

  return (
    <ScrollArea className="max-h-[280px]">
      <div className="space-y-2">
        {uploads.map((upload, i) => (
          <UploadHistoryCard key={upload.uploadId} upload={upload} index={uploads.length - i} />
        ))}
      </div>
    </ScrollArea>
  );
}
