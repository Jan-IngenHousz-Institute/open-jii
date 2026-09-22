import { render, screen } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { CalibrationSessionTally } from "./calibration-session-tally";
import type { SessionUnit } from "./session-unit";

function unit(overrides: Partial<SessionUnit> = {}): SessionUnit {
  return {
    serial: "AA:BB:CC:DD:EE:01",
    deviceId: null,
    deviceName: null,
    runId: crypto.randomUUID(),
    outcome: "recorded",
    ...overrides,
  };
}

describe("CalibrationSessionTally", () => {
  it("counts what was recorded against what passed through the bench", () => {
    render(
      <CalibrationSessionTally
        units={[unit(), unit({ outcome: "failed", reason: "Compute failed" }), unit()]}
      />,
    );

    expect(screen.getByText("iot.calibration.sitting.recordedOf")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
  });

  // A registered unit is known by the name its operator gave it, not by a MAC.
  it("prefers the device name and falls back to the serial", () => {
    render(
      <CalibrationSessionTally
        units={[unit({ deviceName: "Ambit 14" }), unit({ serial: "AA:BB:CC:DD:EE:02" })]}
      />,
    );

    expect(screen.getByText("Ambit 14")).toBeInTheDocument();
    expect(screen.getByText("AA:BB:CC:DD:EE:02")).toBeInTheDocument();
  });

  it("carries the reason a unit was refused, so it is not retried blind", () => {
    render(<CalibrationSessionTally units={[unit({ outcome: "failed", reason: "Saturated" })]} />);

    expect(screen.getByText("Saturated")).toBeInTheDocument();
  });

  it("renders nothing but its heading before any unit has had a turn", () => {
    render(<CalibrationSessionTally units={[]} />);

    expect(screen.getByText("iot.calibration.sitting.thisSitting")).toBeInTheDocument();
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
  });
});
