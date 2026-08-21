"use client";

import { useTrackExports } from "@/components/activity/use-track-exports";
import { StatusBadge } from "@/components/shared/status-badge";
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
  Check,
} from "lucide-react";
import * as React from "react";
import { useDownloadExport } from "~/hooks/experiment/useDownloadExport/useDownloadExport";
import { useListExports } from "~/hooks/experiment/useListExports/useListExports";
import { parseApiError } from "~/util/apiError";
import { formatFileSize } from "~/util/format-file-size";

import type {
  ExperimentExportRecord,
  ExperimentInitiateExportBody,
} from "@repo/api/domains/experiment/experiment.schema";
import { useTranslation } from "@repo/i18n/client";
import { Button } from "@repo/ui/components/button";
import { Card } from "@repo/ui/components/card";
import { DialogFooter } from "@repo/ui/components/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import { ScrollArea } from "@repo/ui/components/scroll-area";
import { Skeleton } from "@repo/ui/components/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@repo/ui/components/tooltip";

import type { CreationStatus } from "../data-export-modal";

interface ExportListStepProps {
  experimentId: string;
  tableName: string;
  displayName?: string;
  onCreateExport: (format: ExperimentInitiateExportBody["format"]) => void;
  onClose: () => void;
  creationStatus?: CreationStatus;
}

const ExportStatusBadge = ({ status }: { status: ExperimentExportRecord["status"] }) => {
  const { t } = useTranslation("experimentData");

  const statusConfig = {
    queued: {
      icon: Clock,
      tone: "archived" as const,
      label: t("experimentData.exportModal.status.queued"),
      spin: false,
    },
    pending: {
      icon: Clock,
      tone: "stale" as const,
      label: t("experimentData.exportModal.status.pending"),
      spin: false,
    },
    running: {
      icon: Loader2,
      tone: "published" as const,
      label: t("experimentData.exportModal.status.running"),
      spin: true,
    },
    completed: {
      icon: CheckCircle2,
      tone: "active" as const,
      label: t("experimentData.exportModal.status.completed"),
      spin: false,
    },
    failed: {
      icon: XCircle,
      tone: "destructive" as const,
      label: t("experimentData.exportModal.status.failed"),
      spin: false,
    },
  };

  const config = status in statusConfig ? statusConfig[status] : statusConfig.pending;
  const Icon = config.icon;

  return (
    <StatusBadge tone={config.tone}>
      <Icon className={`h-3 w-3 ${config.spin ? "animate-spin" : ""}`} />
      {config.label}
    </StatusBadge>
  );
};

const FORMAT_LABELS: Record<string, string> = {
  csv: "CSV",
  ndjson: "NDJSON",
  "json-array": "JSON Array",
  parquet: "Parquet",
  xlsx: "Excel",
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
  export: ExperimentExportRecord;
  onDownload: (exportId: string) => void;
  isDownloading: boolean;
  index: number;
}) => {
  const { t } = useTranslation("experimentData");

  const canDownload = exportRecord.status === "completed" && exportRecord.exportId;
  const isFailed = exportRecord.status === "failed";
  const dateTime = formatDateTime(exportRecord.createdAt);

  // Collect metadata items to render inline
  const metaItems: { icon: React.ElementType; label: string }[] = [];

  metaItems.push({
    icon: FileText,
    label: FORMAT_LABELS[exportRecord.format] ?? exportRecord.format,
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
    <Card className="min-h-[56px] flex-row items-center gap-3 px-3 py-2.5">
      <div className="bg-muted shrink-0 rounded-md p-1.5">
        <FileText className="text-muted-foreground h-4 w-4" />
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <span className="text-foreground text-sm font-semibold">
            {t("experimentData.exportModal.exportTitle", { number: index })}
          </span>
          <ExportStatusBadge status={exportRecord.status} />
        </div>

        <div className="text-muted-foreground flex items-center gap-3 text-xs">
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
          className="h-8 w-8 shrink-0"
        >
          {isDownloading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="text-muted-foreground h-4 w-4" />
          )}
        </Button>
      )}
    </Card>
  );

  if (isFailed) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{card}</TooltipTrigger>
          <TooltipContent
            side="top"
            className="bg-popover text-popover-foreground max-w-xs border text-center shadow-md"
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
  displayName,
  onCreateExport,
  onClose,
  creationStatus = "idle",
}: ExportListStepProps) {
  const { t } = useTranslation("experimentData");
  const { data, isLoading, error } = useListExports({ experimentId, tableName });
  const { downloadExport, isDownloading, downloadingExportId } = useDownloadExport(experimentId);
  const exports = data?.exports ?? [];

  // Mirror every poll into the global activity context so the topbar bell
  // shows export status without the user keeping this modal open.
  useTrackExports({ experimentId, tableName, displayName, exports });

  if (error) {
    const errorMessage =
      parseApiError(error)?.message ?? t("experimentData.exportModal.unknownError");
    return (
      <div className="border-destructive/30 bg-destructive/10 text-destructive rounded-md border p-4 text-sm">
        {t("experimentData.exportModal.error")}: {errorMessage}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 pt-4">
      {isLoading ? (
        <p className="text-muted-foreground text-sm">
          {t("experimentData.exportModal.loadingExports")}
        </p>
      ) : exports.length === 0 ? (
        <Card className="items-center justify-center gap-0 py-8">
          <div className="bg-background mb-3 flex h-16 w-16 items-center justify-center rounded-full">
            <Download className="text-muted-foreground h-8 w-8" />
          </div>
          <p className="text-muted-foreground text-center text-sm">
            {t("experimentData.exportModal.noExports")}
          </p>
        </Card>
      ) : (
        <p className="text-muted-foreground text-sm">
          {t("experimentData.exportModal.exportCount", { count: exports.length })}
        </p>
      )}

      {isLoading ? (
        <ScrollArea className="max-h-[280px]">
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="min-h-[56px] flex-row items-center gap-3 px-3 py-2.5">
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
              </Card>
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
        {creationStatus === "creating" ? (
          <Button disabled className="gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t("experimentData.exportModal.creating")}
          </Button>
        ) : creationStatus === "success" ? (
          <Button disabled className="gap-2">
            <Check className="animate-in zoom-in-0 h-4 w-4 duration-300" />
            {t("experimentData.exportModal.exportCreated")}
          </Button>
        ) : (
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
              <DropdownMenuItem onClick={() => onCreateExport("xlsx")}>Excel</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </DialogFooter>
    </div>
  );
}
