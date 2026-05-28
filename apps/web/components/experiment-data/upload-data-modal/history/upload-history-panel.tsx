"use client";

import { useListUploads } from "~/hooks/experiment/useListUploads/useListUploads";

import { useTranslation } from "@repo/i18n/client";
import { ScrollArea } from "@repo/ui/components/scroll-area";

import { UploadHistoryCard } from "./upload-history-card";
import { UploadHistoryEmpty } from "./upload-history-empty";
import { UploadHistoryLoading } from "./upload-history-loading";

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

      {isLoading ? (
        <UploadHistoryLoading />
      ) : !hasUploads ? (
        <UploadHistoryEmpty />
      ) : (
        <ScrollArea className="max-h-[280px]">
          <div className="space-y-2">
            {uploads.map((upload, i) => (
              <UploadHistoryCard key={upload.uploadId} upload={upload} index={uploads.length - i} />
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
