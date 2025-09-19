import React from "react";

import spadCalibrationProtocol from "../../protocols/calibrations/spad-calibration.json";
import { CalibrationFlow } from "./components/CalibrationFlow";

export function CalibrationScreen() {
  return <CalibrationFlow protocol={spadCalibrationProtocol} />;
}
