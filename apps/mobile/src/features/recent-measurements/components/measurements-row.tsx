import React, { memo } from "react";
import { SwipeableMeasurementRow } from "~/features/recent-measurements/components/swipeable-measurement-row";
import type { MeasurementItem } from "~/features/recent-measurements/hooks/use-all-measurements";
import { isUnsynced } from "~/shared/db/measurements-storage";

interface Props {
  item: MeasurementItem;
  onPress: (id: string) => void;
  onComment: (id: string) => void;
  onFlag: (id: string) => void;
  onDelete: (id: string) => void;
  onSync: (id: string) => void;
  peekToken?: number;
  /** Nested under an expanded workbook-run row. */
  indented?: boolean;
}

export const MeasurementsRow = memo(function MeasurementsRow({
  item,
  onPress,
  onComment,
  onFlag,
  onDelete,
  onSync,
  peekToken,
  indented,
}: Props) {
  const canSync = isUnsynced(item.status);
  return (
    <SwipeableMeasurementRow
      id={item.key}
      timestamp={item.timestamp}
      experimentName={item.experimentName}
      status={item.status}
      failureReason={item.failureReason}
      questions={item.questions}
      onPress={onPress}
      onComment={onComment}
      onFlag={onFlag}
      onDelete={onDelete}
      onSync={canSync ? onSync : undefined}
      hasComment={item.hasComment}
      peekToken={peekToken}
      indented={indented}
    />
  );
});
