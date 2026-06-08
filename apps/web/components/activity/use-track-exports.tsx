"use client";

import { useActivity } from "@/components/activity/activity-context";
import type { ActivityEntry, ActivityJobStatus } from "@/components/activity/activity-context";
import * as React from "react";

import type { ExportRecord } from "@repo/api/schemas/experiment.schema";
import { toast } from "@repo/ui/hooks/use-toast";

const FORMAT_LABELS: Record<string, string> = {
  csv: "CSV",
  ndjson: "NDJSON",
  "json-array": "JSON Array",
  parquet: "Parquet",
};

function mapStatus(s: ExportRecord["status"]): ActivityJobStatus {
  return s === "completed" ? "succeeded" : s;
}

function exportEntryId(record: ExportRecord, tableKey: string): string {
  // Stable across the export's lifecycle: `exportId` only appears after the
  // first poll, so keying on it would orphan the pending entry (duplicate row,
  // skipped transition toast). `tableKey` + `createdAt` is stable from creation.
  return `export-${tableKey}-${record.createdAt}`;
}

/**
 * Mirrors every export visible in a `useListExports` result into the global
 * activity context. The export modal is the only place that polls today, so
 * the bell stays up to date as long as the modal is open; entries persist
 * in-memory for the rest of the session even after the modal closes (until
 * the backend table from OJD-1506 lands).
 */
export function useTrackExports(args: {
  experimentId: string;
  tableName: string;
  displayName?: string;
  exports: ExportRecord[];
}) {
  const { experimentId, tableName, displayName, exports } = args;
  const { upsert } = useActivity();
  // Remember the previous status per export so we can fire a single toast on
  // the running → succeeded / failed transition.
  const prevStatusRef = React.useRef<Map<string, ActivityJobStatus>>(new Map());

  React.useEffect(() => {
    const seenIds = new Set<string>();

    for (const record of exports) {
      const id = exportEntryId(record, tableName);
      seenIds.add(id);

      const status = mapStatus(record.status);
      const label = displayName ?? tableName;
      const format = FORMAT_LABELS[record.format] ?? record.format;
      const entry: ActivityEntry = {
        id,
        kind: "data_export",
        title: `Export of ${label} (${format})`,
        status,
        format: record.format,
        experimentId,
        createdAt: record.createdAt,
        updatedAt: record.completedAt ?? record.createdAt,
        resultUrl: record.exportId
          ? `/api/experiments/${experimentId}/data/exports/${record.exportId}/download`
          : undefined,
      };

      const prev = prevStatusRef.current.get(id);
      if (prev && prev !== status && (status === "succeeded" || status === "failed")) {
        toast({
          description:
            status === "succeeded"
              ? `Export of ${label} ready to download.`
              : `Export of ${label} failed.`,
          variant: status === "failed" ? "destructive" : undefined,
        });
      }
      prevStatusRef.current.set(id, status);

      upsert(entry);
    }

    // Drop any in-flight records the API no longer returns (rare, but keep
    // the ref bounded so it doesn't grow forever in long sessions).
    for (const key of prevStatusRef.current.keys()) {
      if (!seenIds.has(key)) prevStatusRef.current.delete(key);
    }
  }, [exports, experimentId, tableName, displayName, upsert]);
}
