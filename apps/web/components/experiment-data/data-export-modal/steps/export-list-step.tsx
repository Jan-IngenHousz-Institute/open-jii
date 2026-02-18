"use client";

import {
  FileText,
  Download,
  Clock,
  Calendar,
  CheckCircle2,
  XCircle,
  Loader2,
  Plus,
  Rows3,
  HardDrive,
} from "lucide-react";
import * as React from "react";
import { useDownloadExport } from "~/hooks/experiment/useDownloadExport/useDownloadExport";
import { useListExports } from "~/hooks/experiment/useListExports/useListExports";
import { parseApiError } from "~/util/apiError";
import { formatFileSize } from "~/util/format-file-size";

import type { ExportRecord } from "@repo/api";
import { useTranslation } from "@repo/i18n/client";
import {
  Button,
  DialogFooter,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  ScrollArea,
  Skeleton,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@repo/ui/components";

interface ExportListStepProps {
  experimentId: string;
  tableName: string;
  onCreateExport: (format: string) => void;
  onClose: () => void;
}

const statusBorderColor: Record<string, string> = {
  queued: "border-l-gray-400",
  pending: "border-l-yellow-400",
  running: "border-l-blue-400",
  completed: "border-l-green-500",
  failed: "border-l-red-500",
};

const StatusBadge = ({ status }: { status: ExportRecord["status"] }) => {
  const { t } = useTranslation("experimentData");

  const statusConfig = {
    queued: {
      icon: Clock,
      className:
        "bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-950/20 dark:text-gray-400 dark:border-gray-800",
      label: t("experimentData.exportModal.status.queued"),
      spin: false,
    },
    pending: {
      icon: Clock,
      className:
        "bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950/20 dark:text-yellow-400 dark:border-yellow-800",
      label: t("experimentData.exportModal.status.pending"),
      spin: false,
    },
    running: {
      icon: Loader2,
      className:
        "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-800",
      label: t("experimentData.exportModal.status.running"),
      spin: true,
    },
    completed: {
      icon: CheckCircle2,
      className:
        "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/20 dark:text-green-400 dark:border-green-800",
      label: t("experimentData.exportModal.status.completed"),
      spin: false,
    },
    failed: {
      icon: XCircle,
      className:
        "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/20 dark:text-red-400 dark:border-red-800",
      label: t("experimentData.exportModal.status.failed"),
      spin: false,
    },
  };

  const config = status in statusConfig ? statusConfig[status] : statusConfig.pending;
  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${config.className}`}
    >
      <Icon className={`h-3 w-3 ${config.spin ? "animate-spin" : ""}`} />
      {config.label}
    </span>
  );
};

const formatLabel: Record<string, string> = {
  csv: "CSV",
  ndjson: "NDJSON",
  "json-array": "JSON Array",
  parquet: "Parquet",
};

const formatDateTime = (dateString: string | null): string => {
  if (!dateString) return "";
  return new Date(dateString).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const ExportCard = ({
  export: exportRecord,
  onDownload,
  isDownloading,
  index,
}: {
  export: ExportRecord;
  onDownload: (exportId: string) => void;
  isDownloading: boolean;
  index: number;
}) => {
  const { t } = useTranslation("experimentData");

  const canDownload = exportRecord.status === "completed" && exportRecord.exportId;
  const isFailed = exportRecord.status === "failed";
  const borderColor = statusBorderColor[exportRecord.status] ?? "border-l-gray-300";
  const dateTime = formatDateTime(exportRecord.createdAt);

  // Collect metadata items to render inline
  const metaItems: { icon: React.ElementType; label: string }[] = [];

  metaItems.push({
    icon: FileText,
    label: formatLabel[exportRecord.format] ?? exportRecord.format,
  });

  if (exportRecord.rowCount != null) {
    metaItems.push({
      icon: Rows3,
      label: `${exportRecord.rowCount.toLocaleString()} ${t("experimentData.exportModal.rows").toLowerCase()}`,
    });
  }

  if (exportRecord.fileSize != null) {
    metaItems.push({
      icon: HardDrive,
      label: formatFileSize(exportRecord.fileSize),
    });
  }

  const card = (
    <div
      className={`flex min-h-[56px] items-center gap-3 rounded-lg border border-l-4 bg-white px-3 py-2.5 dark:border-gray-700 dark:bg-gray-800 ${borderColor}`}
    >
      <div className="flex-shrink-0 rounded-md bg-gray-100 p-1.5 dark:bg-gray-700">
        <FileText className="h-4 w-4 text-gray-500 dark:text-gray-400" />
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {t("experimentData.exportModal.exportTitle", { number: index })}
          </span>
          <StatusBadge status={exportRecord.status} />
        </div>

        <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
          {metaItems.map((item, i) => {
            const MetaIcon = item.icon;
            return (
              <span key={i} className="inline-flex items-center gap-1">
                <MetaIcon className="h-3 w-3" />
                {item.label}
              </span>
            );
          })}
          {dateTime && (
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {dateTime}
            </span>
          )}
        </div>
      </div>

      {canDownload && exportRecord.exportId && (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onDownload(exportRecord.exportId ?? "")}
          disabled={isDownloading}
          className="h-8 w-8 flex-shrink-0"
        >
          {isDownloading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4 text-gray-500 dark:text-gray-400" />
          )}
        </Button>
      )}
    </div>
  );

  if (isFailed) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{card}</TooltipTrigger>
          <TooltipContent
            side="top"
            className="max-w-xs border bg-white text-center text-gray-700 shadow-md dark:border-gray-700 dark:bg-gray-100 dark:text-gray-800"
          >
            {t("experimentData.exportModal.failedTooltip")}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return card;
};

export function ExportListStep({
  experimentId,
  tableName,
  onCreateExport,
  onClose,
}: ExportListStepProps) {
  const { t } = useTranslation("experimentData");
  const { data, isLoading, error } = useListExports({ experimentId, tableName });
  const { downloadExport, isDownloading, downloadingExportId } = useDownloadExport(experimentId);

  if (error) {
    const errorMessage =
      parseApiError(error)?.message ?? t("experimentData.exportModal.unknownError");
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-600 dark:border-red-800 dark:bg-red-950/20 dark:text-red-400">
        {t("experimentData.exportModal.error")}: {errorMessage}
      </div>
    );
  }

  const exports = data?.body.exports ?? [];

  return (
    <div className="flex flex-col gap-4 pt-4">
      {isLoading ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {t("experimentData.exportModal.loadingExports")}
        </p>
      ) : exports.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border bg-gray-50 py-8 dark:bg-gray-900">
          <div className="bg-muted mb-3 flex h-16 w-16 items-center justify-center rounded-full">
            <Download className="text-muted-foreground h-8 w-8" />
          </div>
          <p className="text-muted-foreground text-center text-sm">
            {t("experimentData.exportModal.noExports")}
          </p>
        </div>
      ) : (
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {t("experimentData.exportModal.exportCount", { count: exports.length })}
        </p>
      )}

      {isLoading ? (
        <ScrollArea className="max-h-[280px]">
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="flex min-h-[56px] items-center gap-3 rounded-lg border border-l-4 border-l-gray-200 bg-white px-3 py-2.5 dark:border-gray-700 dark:border-l-gray-600 dark:bg-gray-800"
              >
                <Skeleton className="h-7 w-7 rounded-md" />
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-10 rounded" />
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-3 w-16 rounded" />
                    <Skeleton className="h-3 w-12 rounded" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      ) : (
        exports.length > 0 && (
          <ScrollArea className="max-h-[280px]">
            <div className="space-y-2">
              {exports.map((exportRecord, index) => (
                <ExportCard
                  key={exportRecord.exportId ?? `export-${index}`}
                  export={exportRecord}
                  index={exports.length - index}
                  onDownload={downloadExport}
                  isDownloading={isDownloading && downloadingExportId === exportRecord.exportId}
                />
              ))}
            </div>
          </ScrollArea>
        )
      )}

      <DialogFooter className="mt-2 flex items-center justify-between gap-2 sm:justify-between">
        <Button variant="outline" onClick={onClose}>
          {t("common.close")}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              {t("experimentData.exportModal.createExport")}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="min-w-[var(--radix-dropdown-menu-trigger-width)]"
          >
            <DropdownMenuItem onClick={() => onCreateExport("csv")}>CSV</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onCreateExport("ndjson")}>NDJSON</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onCreateExport("json-array")}>
              JSON Array
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onCreateExport("parquet")}>Parquet</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </DialogFooter>
    </div>
  );
}
