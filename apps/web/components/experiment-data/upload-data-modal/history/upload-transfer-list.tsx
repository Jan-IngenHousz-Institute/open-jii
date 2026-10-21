"use client";

import { useActivity } from "@/components/activity/activity-context";
import type { ActivityEntry } from "@/components/activity/activity-context";
import { useListUploads } from "~/hooks/experiment/useListUploads/useListUploads";

import { UploadTransferRow } from "./upload-transfer-row";

export interface UploadTransferListProps {
  experimentId: string;
  enabled: boolean;
}

/** Uploads still on their way that the history does not list yet; its card takes over once it does. */
export function UploadTransferList({ experimentId, enabled }: UploadTransferListProps) {
  const { entries } = useActivity();
  const { data } = useListUploads(experimentId, { enabled });
  const recordedUploadIds = new Set(data?.uploads.map((upload) => upload.uploadId));

  const isUnrecordedTransfer = (entry: ActivityEntry) =>
    entry.kind === "data_upload" &&
    entry.experimentId === experimentId &&
    entry.status !== "succeeded" &&
    !recordedUploadIds.has(entry.id);

  const renderTransfer = (transfer: ActivityEntry) => (
    <UploadTransferRow key={transfer.id} transfer={transfer} />
  );

  const transfers = entries.filter(isUnrecordedTransfer);

  if (transfers.length === 0) {
    return null;
  }

  return <div className="space-y-2">{transfers.map(renderTransfer)}</div>;
}
