import { render, screen } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { CalibrationRigChip } from "./calibration-rig-chip";

const CURRENT = { name: "current_a", unit: "A", min: 0, max: 10, integer: false };
const VOLTAGE = { name: "voltage_v", unit: "V", min: 0, max: 32, integer: false };

describe("CalibrationRigChip", () => {
  // The ranges are the reason the chip exists: a sweep is written by typing numbers, and
  // these are the numbers the instrument will take.
  it("says what the role drives, with the range of each setpoint", () => {
    render(
      <CalibrationRigChip
        role="lamp"
        model="kiprim-dc"
        setpoints={[CURRENT, VOLTAGE]}
        readings={[]}
      />,
    );

    expect(screen.getByText("lamp")).toBeInTheDocument();
    expect(screen.getByText("kiprim-dc")).toBeInTheDocument();
    expect(screen.getByText("iot.calibration.rig.setpointRange")).toBeInTheDocument();
    expect(screen.queryByText("iot.calibration.rig.answers")).toBeNull();
  });

  it("says what the role answers", () => {
    render(
      <CalibrationRigChip
        role="par_ref"
        model="minipar-reference"
        setpoints={[]}
        readings={["par", "par_raw"]}
      />,
    );

    expect(screen.getByText("iot.calibration.rig.answers")).toBeInTheDocument();
    // Each reading keeps its separator, so neither is left alone at the start of a line.
    expect(screen.getByText("par")).toBeInTheDocument();
    expect(screen.getByText(/par_raw/)).toBeInTheDocument();
  });

  // A reference sensor drives nothing and needs no line about it; the device does, because
  // there the absence is a fact about the family rather than about the instrument.
  it("keeps quiet about driving nothing unless the caller says otherwise", () => {
    const { rerender } = render(
      <CalibrationRigChip
        role="par_ref"
        model="minipar-reference"
        setpoints={[]}
        readings={["par"]}
      />,
    );

    expect(screen.queryByText("iot.calibration.rig.drives")).toBeNull();

    rerender(
      <CalibrationRigChip
        role="dut"
        model="The device being calibrated"
        setpoints={[]}
        readings={[]}
        noSetpoints="nothing the platform can set"
      />,
    );

    expect(screen.getByText("iot.calibration.rig.drives")).toBeInTheDocument();
    expect(screen.getByText("nothing the platform can set")).toBeInTheDocument();
  });
});
