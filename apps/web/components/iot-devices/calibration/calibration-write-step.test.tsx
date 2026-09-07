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

  it("surfaces a reporting failure without losing the write results", () => {
    renderStep({
      results: { par: { verified: true } },
      error: "The device was written but the result could not be recorded.",
    });

    expect(screen.getByText(/could not be recorded/)).toBeInTheDocument();
    expect(screen.getByText("iot.calibration.write.verified")).toBeInTheDocument();
  });
});
