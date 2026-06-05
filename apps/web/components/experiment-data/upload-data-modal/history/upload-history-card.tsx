"use client";

import type { UploadMetadata } from "@repo/api/schemas/experiment.schema";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@repo/ui/components/tooltip";

import { UploadHistoryCardBody } from "./upload-history-card-body";

export interface UploadHistoryCardProps {
  upload: UploadMetadata;
  index: number;
}

export function UploadHistoryCard({ upload, index }: UploadHistoryCardProps) {
  const body = <UploadHistoryCardBody upload={upload} index={index} />;

  const errorMessage = upload.status === "failed" ? upload.errorMessage : null;
  if (!errorMessage) {
    return body;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{body}</TooltipTrigger>
        <TooltipContent
          side="top"
          className="max-w-xs border bg-white text-center text-gray-700 shadow-md dark:border-gray-700 dark:bg-gray-100 dark:text-gray-800"
        >
          {errorMessage}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
