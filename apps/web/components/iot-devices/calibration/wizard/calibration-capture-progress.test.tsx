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
  // A filter that slipped is why a point gets taken again, and the operator needs to see
  // that it happened. These events were collected and then dropped from the view.
  it("says when a point was taken again, and which attempt it is on", () => {
    render(
      <CalibrationCaptureProgress
        events={[{ kind: "retake", series: "par_sweep", index: 1, attempt: 2 }]}
        isRunning
      />,
    );

    expect(screen.getByText("iot.calibration.capture.retaken")).toBeInTheDocument();
  });

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

  // The steps behind the one running, so a long sweep says how far along it is without
  // the operator counting lines.
  it("carries the procedure's progress as a bar", () => {
    const { container, rerender } = render(
      <CalibrationCaptureProgress
        events={[{ kind: "step", index: 2, total: 4, description: "Read adpd_baseline" }]}
        isRunning
      />,
    );

    // Two of four steps are behind the one running, so the bar is half filled.
    const bar = container.querySelector('[role="progressbar"]');
    expect(bar?.firstElementChild).toHaveStyle({ transform: "translateX(-50%)" });

    rerender(<CalibrationCaptureProgress events={EVENTS} isRunning={false} />);
    expect(container.querySelector('[role="progressbar"]')).toBeNull();
  });

  // The request the operator is answering states the step in its own words; printing the
  // description again above it said the same sentence twice.
  it("counts the step without repeating its description while the operator is answering", () => {
    render(<CalibrationCaptureProgress events={EVENTS} isRunning isWaitingOnOperator />);

    expect(screen.getByText("iot.calibration.capture.stepCounter")).toBeInTheDocument();
    expect(screen.queryByText("iot.calibration.capture.step")).toBeNull();
  });
});
