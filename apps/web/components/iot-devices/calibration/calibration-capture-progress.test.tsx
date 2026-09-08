import { render, screen } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import type { ProcedureProgress } from "@repo/iot";

import { CalibrationCaptureProgress } from "./calibration-capture-progress";

const EVENTS: ProcedureProgress[] = [
  { kind: "step", index: 0, total: 3, description: "Sweep par_sweep" },
  { kind: "setpoint", series: "par_sweep", index: 1, total: 3, value: 300 },
  { kind: "series", series: "par_sweep", rows: 3 },
  { kind: "skipped", series: "led_sweep", reason: 'instrument "emit_ref" is not connected' },
];

describe("CalibrationCaptureProgress", () => {
  it("shows the running step and setpoint above what has completed", () => {
    render(<CalibrationCaptureProgress events={EVENTS} isRunning />);

    expect(screen.getByText("iot.calibration.capture.step")).toBeInTheDocument();
    expect(screen.getByText("iot.calibration.capture.setpoint")).toBeInTheDocument();
    expect(screen.getByText("iot.calibration.capture.series")).toBeInTheDocument();
    expect(screen.getByText("iot.calibration.capture.skipped")).toBeInTheDocument();
  });

  it("keeps only the completed series once the procedure has stopped", () => {
    render(<CalibrationCaptureProgress events={EVENTS} isRunning={false} />);

    expect(screen.queryByText("iot.calibration.capture.step")).toBeNull();
    expect(screen.queryByText("iot.calibration.capture.setpoint")).toBeNull();
    expect(screen.getByText("iot.calibration.capture.series")).toBeInTheDocument();
    expect(screen.getByText("iot.calibration.capture.skipped")).toBeInTheDocument();
  });
});
