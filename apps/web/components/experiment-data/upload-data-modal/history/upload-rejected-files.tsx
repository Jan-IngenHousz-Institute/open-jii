"use client";

import { FileWarning } from "lucide-react";

import type { ExperimentUploadRejectedFile } from "@repo/api/domains/experiment/uploads/experiment-uploads.schema";
import { useTranslation } from "@repo/i18n/client";

export function UploadRejectedFiles({
  rejectedFiles,
  fileCount,
}: {
  rejectedFiles: ExperimentUploadRejectedFile[];
  fileCount: number | null;
}) {
  const { t } = useTranslation("experimentData");

  const renderRejectedFile = (file: ExperimentUploadRejectedFile) => (
    <li key={file.name} className="break-all">
      {t(`experimentData.uploadDataModal.rejectionReasons.${file.reason}`, { name: file.name })}
    </li>
  );

  return (
    <div className="text-muted-foreground space-y-1 text-xs">
      <p className="text-foreground inline-flex items-center gap-1 font-medium">
        <FileWarning className="h-3 w-3" />
        {t("experimentData.uploadDataModal.rejectedFiles", {
          rejected: rejectedFiles.length,
          count: fileCount ?? rejectedFiles.length,
        })}
      </p>
      <ul className="list-inside list-disc space-y-0.5">{rejectedFiles.map(renderRejectedFile)}</ul>
    </div>
  );
}
