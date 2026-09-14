import { createDeviceCalibration } from "@/test/factories";
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
        calibration={createDeviceCalibration({
          writtenToDeviceAt: "2026-09-01T10:06:00.000Z",
          writeResults: { par: { verified: true } },
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
        calibration={createDeviceCalibration()}
        isLoading={false}
        isError={false}
      />,
    );

    expect(screen.getByText("iot.calibration.active.notWritten")).toBeInTheDocument();
  });

  it("shows a load failure as an error rather than as never calibrated", () => {
    render(<ActiveCalibrationCard calibration={undefined} isLoading={false} isError />);

    expect(screen.getByText("iot.calibration.loadError")).toBeInTheDocument();
    expect(screen.queryByText("iot.calibration.active.none")).toBeNull();
  });
});
