"use client";

import { FileWarning } from "lucide-react";

import type {
  ExperimentUploadRejectedFile,
  ExperimentUploadSourceKind,
} from "@repo/api/domains/experiment/uploads/experiment-uploads.schema";
import { useTranslation } from "@repo/i18n/client";

export function UploadRejectedFiles({
  sourceKind,
  rejectedFiles,
  fileCount,
}: {
  sourceKind: ExperimentUploadSourceKind;
  rejectedFiles: ExperimentUploadRejectedFile[];
  fileCount: number | null;
}) {
  const { t } = useTranslation("experimentData");

  // Ambyte rejects whole Ambyte_N folders while the file count counts their files.
  const isAmbyte = sourceKind === "ambyte";
  const summary = isAmbyte
    ? t("experimentData.uploadDataModal.rejectedAmbyteFolders", { count: rejectedFiles.length })
    : t("experimentData.uploadDataModal.rejectedFiles", {
        rejected: rejectedFiles.length,
        count: fileCount ?? rejectedFiles.length,
      });

  const renderRejectedFile = (file: ExperimentUploadRejectedFile) => (
    <li key={file.name} className="break-all">
      {t(`experimentData.uploadDataModal.rejectionReasons.${file.reason}`, { name: file.name })}
    </li>
  );

  return (
    <div className="text-muted-foreground space-y-1 text-xs">
      <p className="text-foreground inline-flex items-center gap-1 font-medium">
        <FileWarning className="h-3 w-3" />
        {summary}
      </p>
      <ul className="list-inside list-disc space-y-0.5">{rejectedFiles.map(renderRejectedFile)}</ul>
    </div>
  );
}
