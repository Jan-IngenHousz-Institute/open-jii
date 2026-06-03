import React from "react";
import { CommentModal } from "~/features/recent-measurements/components/comment-modal";
import { MeasurementQuestionsModal } from "~/features/recent-measurements/components/measurement-questions-modal";
import type { StoredMeasurement } from "~/shared/db/measurements-storage";
import { parseQuestions } from "~/shared/measurements/convert-cycle-answers-to-array";
import { getCommentFromMeasurementResult } from "~/shared/measurements/measurement-annotations";

export type ModalState =
  | { kind: "none" }
  | { kind: "questions"; measurement: StoredMeasurement }
  | { kind: "comment"; measurement: StoredMeasurement };

interface Props {
  state: ModalState;
  onClose: () => void;
  onSaveComment: (m: StoredMeasurement, text: string) => Promise<void>;
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
        experimentName={m.data.metadata.experimentName}
        questions={parseQuestions(m.data.measurementResult)}
        timestamp={m.data.metadata.timestamp}
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
