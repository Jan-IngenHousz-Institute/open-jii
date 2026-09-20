"use client";

import type { OperatorRequest } from "@/hooks/iot/useCalibrationOperator/useCalibrationOperator";

import { CalibrationAnswerPrompt } from "./calibration-answer-prompt";
import { CalibrationReadingConfirm } from "./calibration-reading-confirm";

/**
 * One request at a time; the interpreter is waiting on it. Set apart from the progress
 * around it, because it is the only thing on the step that will not proceed by itself.
 */
export function CalibrationOperatorPrompt({ request }: { request: OperatorRequest }) {
  return (
    <div className="bg-muted/50 rounded-lg p-4">
      {request.kind === "confirmReading" ? (
        <CalibrationReadingConfirm request={request} />
      ) : (
        <CalibrationAnswerPrompt request={request} />
      )}
    </div>
  );
}
