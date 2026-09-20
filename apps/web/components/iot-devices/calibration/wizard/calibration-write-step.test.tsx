import { createDeviceCalibration } from "@/test/factories";
import { render, screen } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { CalibrationWriteStep } from "./calibration-write-step";

function renderStep(overrides: Partial<Parameters<typeof CalibrationWriteStep>[0]> = {}) {
  const props = {
    applied: createDeviceCalibration(),
    canWrite: true,
    results: null,
    error: null,
    verifyEvents: [],
    isVerifying: false,
    verification: null,
    verificationError: null,
    ...overrides,
  };
  render(<CalibrationWriteStep {...props} />);
  return props;
}

describe("CalibrationWriteStep", () => {
  // What is about to reach the hardware is on screen before the operator sends it.
  it("lists each block and its coefficients before anything has been written", () => {
    renderStep();

    expect(screen.getByText("par")).toBeInTheDocument();
    expect(screen.getByText("slope 0.96, intercept -1.08")).toBeInTheDocument();
    expect(screen.queryByText("iot.calibration.write.verified")).toBeNull();
  });

  it("reports each block as confirmed or not once written", () => {
    renderStep({
      results: {
        par: { verified: false, error: 'Device did not confirm "par.intercept"' },
      },
    });

    expect(screen.getByText("iot.calibration.write.failed")).toBeInTheDocument();
    expect(screen.getByText(/did not confirm "par.intercept"/)).toBeInTheDocument();
  });

  // Nothing is rolled back, so an unconfirmed block may be half on the device.
  it("warns that an unconfirmed block may be partly written", () => {
    renderStep({ results: { par: { verified: false, error: "readback disagreed" } } });

    expect(screen.getByText("iot.calibration.write.partial")).toBeInTheDocument();
  });

  it("says nothing about partial writes when every block was confirmed", () => {
    renderStep({ results: { par: { verified: true } } });

    expect(screen.queryByText("iot.calibration.write.partial")).toBeNull();
  });

  // A block the write never reached stays listed without a verdict, rather than vanishing.
  it("lists every block, marking only the ones the write accounted for", () => {
    renderStep({
      applied: createDeviceCalibration({
        blocks: { par: { coefficients: { slope: 0.96 } }, led: { coefficients: { act: 1 } } },
      }),
      results: { par: { verified: true } },
    });

    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getAllByText("iot.calibration.write.verified")).toHaveLength(1);
  });

  // A family the package cannot drive yet is approved on record only, and the
  // step must say so rather than pretend to write.
  it("explains when the platform cannot write to this family", () => {
    renderStep({ canWrite: false });

    expect(screen.getByText("iot.calibration.write.unsupported")).toBeInTheDocument();
    expect(screen.queryByRole("listitem")).toBeNull();
  });

  // The procedure's check after the write is the operator's evidence the new
  // coefficients behave; it is shown beside the write results as it comes in.
  describe("the check after the write", () => {
    it("says nothing about a check when the procedure has none", () => {
      renderStep({ results: { par: { verified: true } } });

      expect(screen.queryByText("iot.calibration.write.verifyHeading")).toBeNull();
    });

    it("shows the check running", () => {
      renderStep({
        results: { par: { verified: true } },
        isVerifying: true,
        verifyEvents: [{ kind: "step", index: 0, total: 1, description: "Read par_check" }],
      });

      expect(screen.getByText("iot.calibration.write.verifying")).toBeInTheDocument();
    });

    it("tables what the device and the reference read afterwards", () => {
      renderStep({
        results: { par: { verified: true } },
        verification: { par_check: [{ par: 398.1, par_ref: 398.5 }] },
      });

      expect(screen.getByText("iot.calibration.write.verifyHeading")).toBeInTheDocument();
      // The same table the captured readings are shown in, so a column means the same
      // thing on both sides of the write.
      expect(screen.getByText("iot.calibration.review.seriesCaption")).toBeInTheDocument();
      expect(screen.getByText("398.1")).toBeInTheDocument();
      expect(screen.getByText("398.5")).toBeInTheDocument();
    });

    it("says why a check stopped early without retracting the write", () => {
      renderStep({
        results: { par: { verified: true } },
        verificationError: "Operator declined: Keep both sensors in the same light",
      });

      expect(screen.getByText("iot.calibration.write.verificationStopped")).toBeInTheDocument();
      expect(screen.getByText("iot.calibration.write.verified")).toBeInTheDocument();
    });
  });

  it("surfaces a reporting failure without losing the write results", () => {
    renderStep({
      results: { par: { verified: true } },
      error: "The device was written but the result could not be recorded.",
    });

    expect(screen.getByText(/could not be recorded/)).toBeInTheDocument();
    expect(screen.getByText("iot.calibration.write.verified")).toBeInTheDocument();
  });
});
