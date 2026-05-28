"use client";

import { Calendar, Database, FileText, Files, Rows3 } from "lucide-react";

import type { UploadMetadata } from "@repo/api/schemas/experiment.schema";
import { useTranslation } from "@repo/i18n/client";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@repo/ui/components/tooltip";

import { UPLOAD_STATUS_BORDER_COLOR, UploadStatusBadge } from "./upload-status-badge";

export interface UploadHistoryCardProps {
  upload: UploadMetadata;
  index: number;
}

export function UploadHistoryCard({ upload, index }: UploadHistoryCardProps) {
  const { t } = useTranslation("experimentData");

  const isFailed = upload.status === "failed";
  const tableLabel =
    upload.uploadTableName ?? t("experimentData.uploadDataModal.history.untargeted");
  const sourceLabel = t(`experimentData.uploadDataModal.history.sourceKind.${upload.sourceKind}`);
  const dateTime = formatDateTime(upload.createdAt);

  const card = (
    <div
      className={`flex min-h-[56px] items-center gap-3 rounded-lg border border-l-4 bg-white px-3 py-2.5 dark:border-gray-700 dark:bg-gray-800 ${UPLOAD_STATUS_BORDER_COLOR[upload.status]}`}
    >
      <div className="flex-shrink-0 rounded-md bg-gray-100 p-1.5 dark:bg-gray-700">
        <Database className="h-4 w-4 text-gray-500 dark:text-gray-400" />
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
            {tableLabel}
          </span>
          <UploadStatusBadge status={upload.status} />
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
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

      <span className="text-muted-foreground hidden flex-shrink-0 text-xs sm:inline">
        {t("experimentData.uploadDataModal.history.uploadTitle", { number: index })}
      </span>
    </div>
  );

  if (!isFailed) {
    return card;
  }

  const tooltipBody =
    upload.errorMessage ?? t("experimentData.uploadDataModal.history.failedTooltip");

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{card}</TooltipTrigger>
        <TooltipContent
          side="top"
          className="max-w-xs border bg-white text-center text-gray-700 shadow-md dark:border-gray-700 dark:bg-gray-100 dark:text-gray-800"
        >
          {tooltipBody}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function formatDateTime(dateString: string | null): string {
  if (!dateString) {
    return "";
  }
  return new Date(dateString).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
