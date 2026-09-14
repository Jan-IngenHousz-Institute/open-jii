import { createDeviceCalibration } from "@/test/factories";
import { render, screen } from "@/test/test-utils";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CalibrationWriteStep } from "./calibration-write-step";

function renderStep(overrides: Partial<Parameters<typeof CalibrationWriteStep>[0]> = {}) {
  const props = {
    applied: createDeviceCalibration(),
    canWrite: true,
    results: null,
    isWriting: false,
    error: null,
    verifyEvents: [],
    isVerifying: false,
    verification: null,
    verificationError: null,
    onWrite: vi.fn(),
    onFinish: vi.fn(),
    ...overrides,
  };
  render(<CalibrationWriteStep {...props} />);
  return props;
}

describe("CalibrationWriteStep", () => {
  it("offers the write before anything has been written", async () => {
    const props = renderStep();

    await userEvent.click(screen.getByRole("button", { name: "iot.calibration.write.action" }));

    expect(props.onWrite).toHaveBeenCalledTimes(1);
  });

  it("reports each block as confirmed or not once written", () => {
    renderStep({
      results: {
        par: { verified: false, error: 'Device did not confirm "par.intercept"' },
      },
    });

    expect(screen.getByText("iot.calibration.write.failed")).toBeInTheDocument();
    expect(screen.getByText(/did not confirm "par.intercept"/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "iot.calibration.write.action" })).toBeNull();
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

  it("lists only the blocks the results account for", () => {
    renderStep({
      applied: createDeviceCalibration({
        blocks: { par: { coefficients: { slope: 0.96 } }, led: { coefficients: { act: 1 } } },
      }),
      results: { par: { verified: true } },
    });

    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getByText("par")).toBeInTheDocument();
  });

  it("closes once the results are on record", async () => {
    const props = renderStep({ results: { par: { verified: true } } });

    expect(screen.getByText("iot.calibration.write.verified")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "iot.calibration.done.close" }));

    expect(props.onFinish).toHaveBeenCalledTimes(1);
  });

  // A family the package cannot drive yet is approved on record only, and the
  // step must say so rather than pretend to write.
  it("explains when the platform cannot write to this family", async () => {
    const props = renderStep({ canWrite: false });

    expect(screen.getByText("iot.calibration.write.unsupported")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "iot.calibration.write.action" })).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "iot.calibration.write.skip" }));
    expect(props.onFinish).toHaveBeenCalledTimes(1);
  });

  // The procedure's check after the write is the operator's evidence the new
  // coefficients behave; it is shown beside the write results as it comes in.
  describe("the check after the write", () => {
    it("says nothing about a check when the procedure has none", () => {
      renderStep({ results: { par: { verified: true } } });

      expect(screen.queryByText("iot.calibration.write.verifyHeading")).toBeNull();
    });

    it("shows the check running and keeps the close button back until it is done", () => {
      renderStep({
        results: { par: { verified: true } },
        isWriting: true,
        isVerifying: true,
        verifyEvents: [{ kind: "step", index: 0, total: 1, description: "Read par_check" }],
      });

      expect(screen.getByText("iot.calibration.write.verifying")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "iot.calibration.done.close" })).toBeDisabled();
    });

    it("tables what the device and the reference read afterwards", () => {
      renderStep({
        results: { par: { verified: true } },
        verification: { par_check: [{ par: 398.1, par_ref: 398.5 }] },
      });

      expect(screen.getByText("iot.calibration.write.verifyHeading")).toBeInTheDocument();
      expect(screen.getByText("par_check")).toBeInTheDocument();
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
