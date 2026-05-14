import React from "react";
import { CommentModal } from "~/components/recent-measurements-screen/comment-modal";
import { MeasurementQuestionsModal } from "~/components/recent-measurements-screen/measurement-questions-modal";
import type { MeasurementItem } from "~/hooks/use-all-measurements";
import { getCommentFromMeasurementResult } from "~/utils/measurement-annotations";

export type ModalState =
  | { kind: "none" }
  | { kind: "questions"; measurement: MeasurementItem }
  | { kind: "comment"; measurement: MeasurementItem };

interface Props {
  state: ModalState;
  onClose: () => void;
  onSaveComment: (m: MeasurementItem, text: string) => Promise<void>;
}

export function MeasurementsModals({ state, onClose, onSaveComment }: Props) {
  if (state.kind === "questions") {
    return <MeasurementQuestionsModal visible measurement={state.measurement} onClose={onClose} />;
  }

  if (state.kind === "comment") {
    const m = state.measurement;
    return (
      <CommentModal
        visible
        initialText={getCommentFromMeasurementResult(
          m.data.measurementResult as Record<string, unknown>,
        )}
        experimentName={m.experimentName}
        questions={m.questions}
        timestamp={m.timestamp}
        onSave={async (text) => {
          await onSaveComment(m, text);
          onClose();
        }}
        onCancel={onClose}
      />
    );
  }

  return null;
}
