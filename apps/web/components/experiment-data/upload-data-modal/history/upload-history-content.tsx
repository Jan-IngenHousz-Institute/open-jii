"use client";

import type { ExperimentUploadRecord } from "@repo/api/domains/experiment/uploads/experiment-uploads.schema";
import { ScrollArea } from "@repo/ui/components/scroll-area";

import { UploadCard } from "./upload-card";
import { UploadHistoryEmpty } from "./upload-history-empty";
import { UploadHistoryError } from "./upload-history-error";
import { UploadHistoryLoading } from "./upload-history-loading";

export interface UploadHistoryContentProps {
  isLoading: boolean;
  error: Error | null;
  uploads: ExperimentUploadRecord[];
}

export function UploadHistoryContent({ isLoading, error, uploads }: UploadHistoryContentProps) {
  const renderUpload = (upload: ExperimentUploadRecord, index: number) => (
    <UploadCard key={upload.uploadId} upload={upload} index={uploads.length - index} />
  );

  const hasUploads = uploads.length > 0;

  // A failed poll keeps the last list it had, which says more than the error does.
  if (error && !hasUploads) {
    return <UploadHistoryError error={error} />;
  }

  if (isLoading) {
    return <UploadHistoryLoading />;
  }

  if (!hasUploads) {
    return <UploadHistoryEmpty />;
  }

  return (
    <ScrollArea className="max-h-[280px]">
      <div className="space-y-2">{uploads.map(renderUpload)}</div>
    </ScrollArea>
  );
}
