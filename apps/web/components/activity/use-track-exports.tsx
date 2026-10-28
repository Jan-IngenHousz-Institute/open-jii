"use client";

import { useActivity } from "@/components/activity/activity-context";
import type { ActivityEntry, ActivityJobStatus } from "@/components/activity/activity-context";
import { EXPORT_FORMAT_LABEL_KEYS } from "@/components/experiment-data/data-export-modal/export-format-label-keys";
import * as React from "react";

import type { ExperimentExportRecord } from "@repo/api/domains/experiment/experiment.schema";
import { useTranslation } from "@repo/i18n/client";
import { toast } from "@repo/ui/hooks/use-toast";

function mapStatus(status: ExperimentExportRecord["status"]): ActivityJobStatus {
  if (status === "completed" || status === "expired") {
    return "succeeded";
  }
  return status;
}

/**
 * Mirrors every export visible in a `useListExports` result into the activity
 * context, and toasts once when an export the user is watching finishes. The
 * server notification reaches them when they are not watching.
 */
export function useTrackExports(args: {
  experimentId: string;
  tableName: string;
  displayName?: string;
  exports: ExperimentExportRecord[];
}) {
  const { experimentId, tableName, displayName, exports } = args;
  const { t } = useTranslation("experimentData");
  const { upsert } = useActivity();
  // Remember the previous status per export so we can fire a single toast on
  // the running → succeeded / failed transition.
  const prevStatusRef = React.useRef<Map<string, ActivityJobStatus>>(new Map());

  React.useEffect(() => {
    const seenIds = new Set<string>();
    const name = displayName ?? tableName;

    for (const record of exports) {
      const id = `export-${record.exportId}`;
      seenIds.add(id);

      const status = mapStatus(record.status);
      const prev = prevStatusRef.current.get(id);
      const entry: ActivityEntry = {
        id,
        kind: "data_export",
        title: t("experimentData.exportModal.activityTitle", {
          name,
          format: t(EXPORT_FORMAT_LABEL_KEYS[record.format]),
        }),
        status,
        format: record.format,
        experimentId,
        createdAt: record.createdAt,
        updatedAt: record.completedAt ?? record.createdAt,
      };

      const hasJustFinished =
        prev !== undefined && prev !== status && (status === "succeeded" || status === "failed");
      if (hasJustFinished) {
        toast({
          description:
            status === "succeeded"
              ? t("experimentData.exportModal.exportReady", { name })
              : t("experimentData.exportModal.exportFailed", { name }),
          variant: status === "failed" ? "destructive" : undefined,
        });
      }
      prevStatusRef.current.set(id, status);

      upsert(entry);
    }

    // Keep the ref bounded in long sessions.
    for (const key of prevStatusRef.current.keys()) {
      if (!seenIds.has(key)) prevStatusRef.current.delete(key);
    }
  }, [exports, experimentId, tableName, displayName, upsert, t]);
}
