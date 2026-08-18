import React, { memo } from "react";
import { MeasurementRunItem } from "~/features/recent-measurements/components/measurement-run-item";
import { SwipeableRow } from "~/features/recent-measurements/components/swipeable-row";
import type { MeasurementRunEntry } from "~/features/recent-measurements/utils/group-measurements-by-run";
import { summarizeRun } from "~/features/recent-measurements/utils/group-measurements-by-run";

interface Props {
  entry: MeasurementRunEntry;
  expanded: boolean;
  onToggle: (runKey: string) => void;
  /** Uploads every unsynced measurement in the run. */
  onSync: (runKey: string) => void;
  /** Deletes the whole run. */
  onDelete: (runKey: string) => void;
  peekToken?: number;
}

export const MeasurementsRunRow = memo(function MeasurementsRunRow({
  entry,
  expanded,
  onToggle,
  onSync,
  onDelete,
  peekToken,
}: Props) {
  const summary = summarizeRun(entry.items);
  return (
    <SwipeableRow
      id={entry.key}
      status={summary.status}
      onSync={summary.hasUnsynced ? onSync : undefined}
      onDelete={onDelete}
      peekToken={peekToken}
      expanded={expanded}
    >
      <MeasurementRunItem
        id={entry.key}
        count={summary.count}
        experimentName={summary.experimentName}
        timestamp={summary.timestamp}
        status={summary.status}
        questions={summary.questions}
        hasComment={summary.hasComment}
        expanded={expanded}
        onToggle={onToggle}
      />
    </SwipeableRow>
  );
});
