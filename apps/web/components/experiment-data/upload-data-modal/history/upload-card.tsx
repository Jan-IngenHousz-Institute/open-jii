"use client";

import { formatDateTime } from "@/util/date";
import { formatLocaleNumber } from "@/util/format-locale-number";
import { Calendar, Database, FileText, Files, Rows3 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useLocale } from "~/hooks/useLocale";

import type { ExperimentUploadRecord } from "@repo/api/domains/experiment/uploads/experiment-uploads.schema";
import { useTranslation } from "@repo/i18n/client";
import { Card } from "@repo/ui/components/card";

import { UPLOAD_SOURCE_KIND_LABEL_KEYS } from "../upload-source-kind-label-keys";
import { UploadRejectedFiles } from "./upload-rejected-files";
import { UploadStatusBadge } from "./upload-status-badge";

export function UploadCard({ upload, index }: { upload: ExperimentUploadRecord; index: number }) {
  const { t } = useTranslation("experimentData");
  const locale = useLocale();

  // Uploads carried over from the old history have no table name.
  const title =
    upload.uploadTableName ??
    t("experimentData.uploadDataModal.history.uploadTitle", { number: index });
  const failureReason =
    upload.status === "failed"
      ? t(`experimentData.uploadDataModal.errors.${upload.errorCode ?? "unknown"}`)
      : null;
  const hasRejectedFiles = upload.rejectedFiles.length > 0;

  const metaItems: { icon: LucideIcon; label: string }[] = [
    { icon: FileText, label: t(UPLOAD_SOURCE_KIND_LABEL_KEYS[upload.sourceKind]) },
  ];
  if (upload.rowCount !== null) {
    metaItems.push({
      icon: Rows3,
      label: t("experimentData.uploadDataModal.history.rowCount", {
        count: upload.rowCount,
        formatted: formatLocaleNumber(upload.rowCount, locale),
      }),
    });
  }
  if (upload.fileCount !== null) {
    metaItems.push({
      icon: Files,
      label: t("experimentData.uploadDataModal.history.fileCount", { count: upload.fileCount }),
    });
  }
  metaItems.push({ icon: Calendar, label: formatDateTime(upload.createdAt, locale) });

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
          <Database className="text-muted-foreground h-4 w-4" />
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <span className="text-foreground truncate text-sm font-semibold">{title}</span>
            <UploadStatusBadge status={upload.status} />
          </div>

          <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            {metaItems.map(renderMetaItem)}
          </div>
        </div>
      </div>

      {failureReason && <p className="text-destructive text-xs">{failureReason}</p>}
      {hasRejectedFiles && (
        <UploadRejectedFiles
          sourceKind={upload.sourceKind}
          rejectedFiles={upload.rejectedFiles}
          fileCount={upload.fileCount}
        />
      )}
    </Card>
  );
}
