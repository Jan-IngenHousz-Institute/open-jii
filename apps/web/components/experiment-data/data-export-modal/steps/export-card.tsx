"use client";

import { formatDateTime } from "@/util/date";
import { formatLocaleNumber } from "@/util/format-locale-number";
import {
  Calendar,
  ChevronDown,
  ChevronUp,
  FileText,
  Files,
  HardDrive,
  Rows3,
  TimerOff,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import * as React from "react";
import { useLocale } from "~/hooks/useLocale";
import { formatFileSize } from "~/util/format-file-size";

import type { ExperimentExportRecord } from "@repo/api/domains/experiment/experiment.schema";
import { useTranslation } from "@repo/i18n/client";
import { Button } from "@repo/ui/components/button";
import { Card } from "@repo/ui/components/card";

import { EXPORT_FORMAT_LABEL_KEYS } from "../export-format-label-keys";
import { ExportDownloadButton } from "./export-download-button";
import { ExportPartsList } from "./export-parts-list";
import { ExportStatusBadge } from "./export-status-badge";

export function ExportCard({
  export: exportRecord,
  experimentId,
  index,
}: {
  export: ExperimentExportRecord;
  experimentId: string;
  index: number;
}) {
  const { t } = useTranslation("experimentData");
  const locale = useLocale();
  const [showFiles, setShowFiles] = React.useState(false);
  const filesId = React.useId();

  const isCompleted = exportRecord.status === "completed";
  const partCount = exportRecord.partCount ?? 0;
  const isMultiPart = isCompleted && partCount > 1;
  const failureReason =
    exportRecord.status === "failed"
      ? t(`experimentData.exportModal.errors.${exportRecord.errorCode ?? "unknown"}`)
      : null;

  const metaItems: { icon: LucideIcon; label: string }[] = [
    { icon: FileText, label: t(EXPORT_FORMAT_LABEL_KEYS[exportRecord.format]) },
  ];
  if (exportRecord.rowCount != null) {
    metaItems.push({
      icon: Rows3,
      label: t("experimentData.exportModal.rowCount", {
        count: exportRecord.rowCount,
        formatted: formatLocaleNumber(exportRecord.rowCount, locale),
      }),
    });
  }
  if (exportRecord.totalBytes != null) {
    metaItems.push({ icon: HardDrive, label: formatFileSize(exportRecord.totalBytes) });
  }
  if (isMultiPart) {
    metaItems.push({
      icon: Files,
      label: t("experimentData.exportModal.parts", { count: partCount }),
    });
  }
  metaItems.push({ icon: Calendar, label: formatDateTime(exportRecord.createdAt, locale) });
  if (isCompleted && exportRecord.expiresAt) {
    metaItems.push({
      icon: TimerOff,
      label: t("experimentData.exportModal.expiresOn", {
        date: formatDateTime(exportRecord.expiresAt, locale),
      }),
    });
  }

  const toggleFiles = () => setShowFiles((shown) => !shown);

  const renderMetaItem = ({ icon: MetaIcon, label }: { icon: LucideIcon; label: string }) => (
    <span key={label} className="inline-flex items-center gap-1">
      <MetaIcon className="h-3 w-3" />
      {label}
    </span>
  );

  return (
    <Card className="min-h-[56px] gap-2 px-3 py-2.5">
      <div className="flex items-center gap-3">
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

          <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            {metaItems.map(renderMetaItem)}
          </div>
        </div>

        {isCompleted && !isMultiPart && (
          <ExportDownloadButton
            experimentId={experimentId}
            exportId={exportRecord.exportId}
            tableName={exportRecord.tableName}
          />
        )}
        {isMultiPart && (
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0 gap-1"
            aria-expanded={showFiles}
            aria-controls={filesId}
            onClick={toggleFiles}
          >
            {showFiles ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            {showFiles
              ? t("experimentData.exportModal.hideFiles")
              : t("experimentData.exportModal.showFiles")}
          </Button>
        )}
      </div>

      {failureReason && <p className="text-destructive text-xs">{failureReason}</p>}
      {isMultiPart && showFiles && (
        <ExportPartsList
          id={filesId}
          experimentId={experimentId}
          exportId={exportRecord.exportId}
        />
      )}
    </Card>
  );
}
