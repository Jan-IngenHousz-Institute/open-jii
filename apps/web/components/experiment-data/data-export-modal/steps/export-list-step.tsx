"use client";

import { FileText, Download, Clock, CheckCircle2, XCircle, Loader2, Plus } from "lucide-react";
import * as React from "react";
import { useListExports } from "~/hooks/experiment/useListExports/useListExports";
import { parseApiError } from "~/util/apiError";
import { formatFileSize } from "~/util/format-file-size";

import type { ExportRecord } from "@repo/api";
import { useTranslation } from "@repo/i18n/client";
import { Button, DialogFooter, ScrollArea } from "@repo/ui/components";

interface ExportListStepProps {
  experimentId: string;
  tableName: string;
  onCreateNew: () => void;
  onClose: () => void;
}

const StatusBadge = ({ status }: { status: ExportRecord["status"] }) => {
  const { t } = useTranslation("experimentData");

  const statusConfig = {
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

  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${config.className}`}
    >
      <Icon className={`h-3 w-3 ${config.spin ? "animate-spin" : ""}`} />
      {config.label}
    </div>
  );
};

const ExportCard = ({
  export: exportRecord,
  onDownload,
}: {
  export: ExportRecord;
  onDownload: (exportId: string) => void;
}) => {
  const { t } = useTranslation("experimentData");

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-";
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(dateString));
  };

  const canDownload = exportRecord.status === "completed" && exportRecord.exportId;

  return (
    <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-start gap-4">
        <div className="rounded-full bg-blue-100 p-2 dark:bg-blue-900/30">
          <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
        </div>
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold uppercase text-gray-900 dark:text-gray-100">
              {exportRecord.format}
            </span>
            <StatusBadge status={exportRecord.status} />
          </div>
          <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
            <div>
              <span className="font-medium">{t("experimentData.exportModal.created")}:</span>{" "}
              {formatDate(exportRecord.createdAt)}
            </div>
            {exportRecord.completedAt && (
              <div>
                <span className="font-medium">{t("experimentData.exportModal.completed")}:</span>{" "}
                {formatDate(exportRecord.completedAt)}
              </div>
            )}
            {exportRecord.rowCount !== null && (
              <div>
                <span className="font-medium">{t("experimentData.exportModal.rows")}:</span>{" "}
                {exportRecord.rowCount.toLocaleString()}
              </div>
            )}
            {exportRecord.fileSize !== null && (
              <div>
                <span className="font-medium">{t("experimentData.exportModal.size")}:</span>{" "}
                {formatFileSize(exportRecord.fileSize)}
              </div>
            )}
          </div>
        </div>
      </div>
      {canDownload && exportRecord.exportId && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => onDownload(exportRecord.exportId ?? "")}
          className="flex-shrink-0"
        >
          <Download className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
};

export function ExportListStep({
  experimentId,
  tableName,
  onCreateNew,
  onClose,
}: ExportListStepProps) {
  const { t } = useTranslation("experimentData");
  const { data, isLoading, error } = useListExports({ experimentId, tableName });

  const handleDownload = (exportId: string) => {
    // Construct the download URL
    const url = `/api/v1/experiments/${experimentId}/data/exports/${exportId}`;

    // Trigger download by creating a temporary link
    const link = document.createElement("a");
    link.href = url;
    link.download = "";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

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
    <div className="space-y-4 py-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {exports.length === 0
            ? t("experimentData.exportModal.noExports")
            : t("experimentData.exportModal.exportCount", { count: exports.length })}
        </p>
        <Button onClick={onCreateNew} size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          {t("experimentData.exportModal.createNew")}
        </Button>
      </div>

      {exports.length > 0 && (
        <ScrollArea className="max-h-[400px] pr-4">
          <div className="space-y-3">
            {exports.map((exportRecord, index) => (
              <ExportCard
                key={exportRecord.exportId ?? `export-${index}`}
                export={exportRecord}
                onDownload={handleDownload}
              />
            ))}
          </div>
        </ScrollArea>
      )}

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          {t("common.close")}
        </Button>
      </DialogFooter>
    </div>
  );
}
