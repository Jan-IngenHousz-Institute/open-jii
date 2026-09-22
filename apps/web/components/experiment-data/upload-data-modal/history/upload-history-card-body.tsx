"use client";

import { Calendar, Database, FileText, Files, Rows3 } from "lucide-react";
import * as React from "react";

import type { ExperimentUploadMetadata } from "@repo/api/domains/experiment/experiment.schema";
import { useTranslation } from "@repo/i18n/client";
import { Card } from "@repo/ui/components/card";
import { cn } from "@repo/ui/lib/utils";

import { UploadStatusBadge } from "./upload-status-badge";

export interface UploadHistoryCardBodyProps extends React.ComponentPropsWithoutRef<"div"> {
  upload: ExperimentUploadMetadata;
  index: number;
}

// forwardRef so it can be a Radix TooltipTrigger asChild child.
export const UploadHistoryCardBody = React.forwardRef<HTMLDivElement, UploadHistoryCardBodyProps>(
  function UploadHistoryCardBody({ upload, index, className, ...props }, ref) {
    const { t } = useTranslation("experimentData");

    const tableLabel =
      upload.uploadTableName ?? t("experimentData.uploadDataModal.history.untargeted");
    const sourceLabel = t(`experimentData.uploadDataModal.history.sourceKind.${upload.sourceKind}`);
    const dateTime = formatDateTime(upload.createdAt);

    return (
      <Card
        ref={ref}
        className={cn("min-h-[56px] flex-row items-center gap-3 px-3 py-2.5", className)}
        {...props}
      >
        <div className="bg-muted shrink-0 rounded-md p-1.5">
          <Database className="text-muted-foreground h-4 w-4" />
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <span className="text-foreground truncate text-sm font-semibold">{tableLabel}</span>
            <UploadStatusBadge status={upload.status} />
          </div>

          <div className="text-muted-foreground flex flex-wrap items-center gap-3 text-xs">
            <span className="inline-flex items-center gap-1">
              <FileText className="h-3 w-3" />
              {sourceLabel}
            </span>
            {upload.rowCount !== null && (
              <span className="inline-flex items-center gap-1">
                <Rows3 className="h-3 w-3" />
                {t("experimentData.uploadDataModal.history.rowCount", { count: upload.rowCount })}
              </span>
            )}
            {upload.fileCount !== null && (
              <span className="inline-flex items-center gap-1">
                <Files className="h-3 w-3" />
                {t("experimentData.uploadDataModal.history.fileCount", { count: upload.fileCount })}
              </span>
            )}
            {dateTime && (
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {dateTime}
              </span>
            )}
          </div>
        </div>

        <span className="text-muted-foreground hidden shrink-0 text-xs sm:inline">
          {t("experimentData.uploadDataModal.history.uploadTitle", { number: index })}
        </span>
      </Card>
    );
  },
);

function formatDateTime(dateString: string | null): string {
  if (!dateString) {
    return "";
  }
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
