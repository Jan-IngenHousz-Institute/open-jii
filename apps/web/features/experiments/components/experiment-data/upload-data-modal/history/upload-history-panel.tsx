"use client";

import { useListUploads } from "@/features/experiments/hooks/useListUploads/useListUploads";

import { useTranslation } from "@repo/i18n/client";

import { UploadHistoryContent } from "./upload-history-content";

export interface UploadHistoryPanelProps {
  experimentId: string;
  uploadTableName?: string;
  enabled: boolean;
}

export function UploadHistoryPanel({
  experimentId,
  uploadTableName,
  enabled,
}: UploadHistoryPanelProps) {
  const { t } = useTranslation("experimentData");
  const { data, isLoading } = useListUploads(experimentId, { uploadTableName, enabled });
  const uploads = data?.body.uploads ?? [];
  const hasUploads = uploads.length > 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">{t("experimentData.uploadDataModal.history.title")}</h4>
        {hasUploads && (
          <span className="text-muted-foreground text-xs">
            {t("experimentData.uploadDataModal.history.uploadCount", { count: uploads.length })}
          </span>
        )}
      </div>

      <UploadHistoryContent isLoading={isLoading} uploads={uploads} />
    </div>
  );
}
