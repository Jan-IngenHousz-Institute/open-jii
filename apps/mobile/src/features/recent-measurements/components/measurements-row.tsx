import React, { memo } from "react";
import { SwipeableMeasurementRow } from "~/features/recent-measurements/components/swipeable-measurement-row";
import type { MeasurementItem } from "~/features/recent-measurements/hooks/use-all-measurements";

interface Props {
  item: MeasurementItem;
  onPress: (id: string) => void;
  onComment: (id: string) => void;
  onDelete: (id: string) => void;
  onSync: (id: string) => void;
}

export const MeasurementsRow = memo(function MeasurementsRow({
  item,
  onPress,
  onComment,
  onDelete,
  onSync,
}: Props) {
  const canFlag = item.status === "pending" || item.status === "failed";
  return (
    <SwipeableMeasurementRow
      id={item.key}
      timestamp={item.timestamp}
      experimentName={item.experimentName}
      status={item.status}
      questions={item.questions}
      onPress={onPress}
      onComment={canFlag ? onComment : undefined}
      onDelete={onDelete}
      onSync={canFlag ? onSync : undefined}
      hasComment={item.hasComment}
    />
  );
});
