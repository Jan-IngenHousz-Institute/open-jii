"use client";

import type { ActivityEntry } from "@/components/activity/activity-context";
import { StatusBadge } from "@/components/shared/status-badge";
import { Database, Loader2, XCircle } from "lucide-react";

import { useTranslation } from "@repo/i18n/client";
import { Card } from "@repo/ui/components/card";

export interface UploadTransferRowProps {
  transfer: ActivityEntry;
}

export function UploadTransferRow({ transfer }: UploadTransferRowProps) {
  const { t } = useTranslation("experimentData");
  const isFailed = transfer.status === "failed";

  return (
    <Card className="min-h-[56px] flex-row items-center gap-3 px-3 py-2.5">
      <div className="bg-muted shrink-0 rounded-md p-1.5">
        <Database className="text-muted-foreground h-4 w-4" />
      </div>

      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span className="text-foreground truncate text-sm font-semibold">{transfer.title}</span>
        {isFailed ? (
          <StatusBadge tone="destructive">
            <XCircle className="h-3 w-3" />
            {t("experimentData.uploadDataModal.transfer.statusFailed")}
          </StatusBadge>
        ) : (
          <StatusBadge tone="published">
            <Loader2 className="h-3 w-3 animate-spin" />
            {t("experimentData.uploadDataModal.transfer.statusUploading")}
          </StatusBadge>
        )}
      </div>
    </Card>
  );
}
