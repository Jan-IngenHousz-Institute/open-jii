import { createActiveDeviceCalibration } from "@/test/factories";
import { render, screen } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { ActiveCalibrationCard } from "./active-calibration-card";

describe("ActiveCalibrationCard", () => {
  it("says so when the device was never calibrated", () => {
    render(<ActiveCalibrationCard calibration={null} isLoading={false} isError={false} />);

    expect(screen.getByText("iot.calibration.active.none")).toBeInTheDocument();
  });

  it("shows the coefficients in force and that they reached the device", () => {
    render(
      <ActiveCalibrationCard
        calibration={createActiveDeviceCalibration({
          blocks: {
            par: {
              coefficients: { slope: 0.96, intercept: -1.08 },
              calibrationId: "33333333-3333-4333-8333-333333333333",
              runId: "44444444-4444-4444-8444-444444444444",
              validFrom: "2026-09-01T10:05:00.000Z",
              writtenToDeviceAt: "2026-09-01T10:06:00.000Z",
              writeResult: { verified: true },
            },
          },
        })}
        isLoading={false}
        isError={false}
      />,
    );

    expect(screen.getByText("iot.calibration.active.written")).toBeInTheDocument();
    expect(screen.getByText("0.96")).toBeInTheDocument();
    expect(screen.getByText("-1.08")).toBeInTheDocument();
  });

  // Approved on record is not the same as on the device, and the card must not
  // let the two read alike.
  it("flags a calibration that is approved but not yet on the device", () => {
    render(
      <ActiveCalibrationCard
        calibration={createActiveDeviceCalibration()}
        isLoading={false}
        isError={false}
      />,
    );

    expect(screen.getByText("iot.calibration.active.notWritten")).toBeInTheDocument();
  });

  // Two bench procedures can calibrate different parts of one device, so the card must
  // say which session each block came from rather than implying they share one.
  it("shows each block with the session that set it", () => {
    render(
      <ActiveCalibrationCard
        calibration={createActiveDeviceCalibration({
          blocks: {
            par: {
              coefficients: { slope: 0.99 },
              calibrationId: "33333333-3333-4333-8333-333333333333",
              runId: "44444444-4444-4444-8444-444444444444",
              validFrom: "2026-09-10T09:00:00.000Z",
              writtenToDeviceAt: "2026-09-10T09:01:00.000Z",
              writeResult: { verified: true },
            },
            spec: {
              coefficients: { channel_coefficients: [1.5, 2.5] },
              calibrationId: "55555555-5555-4555-8555-555555555555",
              runId: "66666666-6666-4666-8666-666666666666",
              validFrom: "2026-01-04T09:00:00.000Z",
              writtenToDeviceAt: null,
              writeResult: null,
            },
          },
        })}
        isLoading={false}
        isError={false}
      />,
    );

    expect(screen.getByText("par")).toBeInTheDocument();
    expect(screen.getByText("spec")).toBeInTheDocument();
    expect(screen.getByText("0.99")).toBeInTheDocument();
    expect(screen.getByText("[1.5, 2.5]")).toBeInTheDocument();
    // One reached the device, the other never did.
    expect(screen.getByText("iot.calibration.active.written")).toBeInTheDocument();
    expect(screen.getByText("iot.calibration.active.notWritten")).toBeInTheDocument();
  });

  it("shows a load failure as an error rather than as never calibrated", () => {
    render(<ActiveCalibrationCard calibration={undefined} isLoading={false} isError />);

    expect(screen.getByText("iot.calibration.loadError")).toBeInTheDocument();
    expect(screen.queryByText("iot.calibration.active.none")).toBeNull();
  });
});
