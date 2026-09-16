import { render, screen } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { CalibrationOutputBlocks } from "./calibration-output-blocks";

describe("CalibrationOutputBlocks", () => {
  // The coupling that otherwise fails silently: a block no writer covers is captured,
  // fitted, approved, and then never reaches the device. The author should learn that
  // here rather than at the bench.
  it("warns about a coefficient the platform has no command for", () => {
    render(
      <CalibrationOutputBlocks
        family="minipar"
        outputSchema={{
          blocks: {
            par: { slope: { type: "number" }, gain: { type: "number" } },
          },
        }}
      />,
    );

    expect(screen.getByText(/iot.calibration.detail.notWritable/)).toBeInTheDocument();
  });

  it("says nothing when every coefficient can be written", () => {
    render(
      <CalibrationOutputBlocks
        family="minipar"
        outputSchema={{
          blocks: { par: { slope: { type: "number" }, intercept: { type: "number" } } },
        }}
      />,
    );

    expect(screen.queryByText(/iot.calibration.detail.notWritable/)).toBeNull();
    expect(screen.getByText("slope")).toBeInTheDocument();
  });

  // A family with no writers at all is legitimate: the run is recorded, nothing is sent.
  it("warns for a family the platform cannot write at all", () => {
    render(
      <CalibrationOutputBlocks
        family="multispeq"
        outputSchema={{ blocks: { led1: { slope: { type: "number" } } } }}
      />,
    );

    expect(screen.getByText(/iot.calibration.detail.notWritable/)).toBeInTheDocument();
  });

  it("shows each coefficient's type and bounds", () => {
    render(
      <CalibrationOutputBlocks
        family="minipar"
        outputSchema={{
          blocks: { spec: { channel_coefficients: { type: "number_array", length: 10 } } },
        }}
      />,
    );

    expect(screen.getByText("number_array[10]")).toBeInTheDocument();
  });
});
