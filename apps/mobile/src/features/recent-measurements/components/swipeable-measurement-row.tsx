import React, { memo } from "react";
import { MeasurementItem } from "~/features/recent-measurements/components/measurement-item";
import { SwipeableRow } from "~/features/recent-measurements/components/swipeable-row";
import type { MeasurementStatus } from "~/features/recent-measurements/hooks/use-all-measurements";
import { AnswerData } from "~/shared/measurements/convert-cycle-answers-to-array";

interface SwipeableMeasurementRowProps {
  id: string;
  timestamp: string;
  experimentName: string;
  status: MeasurementStatus;
  questions?: AnswerData[];
  onPress?: (id: string) => void;
  onComment?: (id: string) => void;
  onSync?: (id: string) => void;
  onDelete?: (id: string) => void;
  hasComment?: boolean;
  peekToken?: number;
  /** Nested under an expanded workbook-run row. */
  indented?: boolean;
}

export const SwipeableMeasurementRow = memo(function SwipeableMeasurementRow({
  id,
  timestamp,
  experimentName,
  status,
  questions,
  onPress,
  onComment,
  onSync,
  onDelete,
  hasComment = false,
  peekToken = 0,
  indented = false,
}: SwipeableMeasurementRowProps) {
  return (
    <SwipeableRow
      id={id}
      status={status}
      onComment={onComment}
      onSync={onSync}
      onDelete={onDelete}
      peekToken={peekToken}
      indented={indented}
    >
      <MeasurementItem
        id={id}
        timestamp={timestamp}
        experimentName={experimentName}
        status={status}
        questions={questions}
        onPress={onPress}
        hideActions
        hasComment={hasComment}
        indented={indented}
      />
    </SwipeableRow>
  );
});
