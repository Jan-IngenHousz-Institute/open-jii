"use client";

import type { ExperimentUploadMetadata } from "@repo/api/domains/experiment/experiment.schema";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@repo/ui/components/tooltip";

import { UploadHistoryCardBody } from "./upload-history-card-body";

export interface UploadHistoryCardProps {
  upload: ExperimentUploadMetadata;
  index: number;
}

export function UploadHistoryCard({ upload, index }: UploadHistoryCardProps) {
  const errorMessage = upload.status === "failed" ? upload.errorMessage : null;
  if (!errorMessage) {
    return <UploadHistoryCardBody upload={upload} index={index} />;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <UploadHistoryCardBody
            upload={upload}
            index={index}
            tabIndex={0}
            className="focus-visible:ring-ring focus-visible:outline-hidden rounded-lg focus-visible:ring-2"
          />
        </TooltipTrigger>
        <TooltipContent
          side="top"
          className="bg-popover text-popover-foreground max-w-xs border text-center shadow-md"
        >
          {errorMessage}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
