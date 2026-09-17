"use client";

import type { OperatorRequest } from "@/hooks/iot/useCalibrationOperator/useCalibrationOperator";

import { CalibrationAnswerPrompt } from "./calibration-answer-prompt";
import { CalibrationReadingConfirm } from "./calibration-reading-confirm";

/** One request at a time; the interpreter is waiting on it. */
export function CalibrationOperatorPrompt({ request }: { request: OperatorRequest }) {
  if (request.kind === "confirmReading") {
    return <CalibrationReadingConfirm request={request} />;
  }
  return <CalibrationAnswerPrompt request={request} />;
}
