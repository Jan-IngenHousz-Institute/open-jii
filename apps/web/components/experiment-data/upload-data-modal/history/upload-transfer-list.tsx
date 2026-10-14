"use client";

import { useActivity } from "@/components/activity/activity-context";

import { UploadTransferRow } from "./upload-transfer-row";

export interface UploadTransferListProps {
  experimentId: string;
}

/** Uploads still on their way to the backend, which the history only lists once they arrive. */
export function UploadTransferList({ experimentId }: UploadTransferListProps) {
  const { entries } = useActivity();
  const transfers = entries.filter(
    (entry) =>
      entry.kind === "data_upload" &&
      entry.experimentId === experimentId &&
      entry.status !== "succeeded",
  );

  if (transfers.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      {transfers.map((transfer) => (
        <UploadTransferRow key={transfer.id} transfer={transfer} />
      ))}
    </div>
  );
}
