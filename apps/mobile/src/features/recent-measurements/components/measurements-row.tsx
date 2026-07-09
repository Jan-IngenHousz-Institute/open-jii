import React, { memo } from "react";
import { SwipeableMeasurementRow } from "~/features/recent-measurements/components/swipeable-measurement-row";
import type { MeasurementItem } from "~/features/recent-measurements/hooks/use-all-measurements";
import { isUnsynced } from "~/shared/db/measurements-storage";

interface Props {
  item: MeasurementItem;
  onPress: (id: string) => void;
  onComment: (id: string) => void;
  onDelete: (id: string) => void;
  onSync: (id: string) => void;
  peekToken?: number;
}

export const MeasurementsRow = memo(function MeasurementsRow({
  item,
  onPress,
  onComment,
  onDelete,
  onSync,
  peekToken,
}: Props) {
  const canFlag = isUnsynced(item.status);
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
      peekToken={peekToken}
    />
  );
});
