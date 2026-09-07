import { createDeviceCalibration } from "@/test/factories";
import { server } from "@/test/msw/server";
import { renderHook, waitFor } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { contract } from "@repo/api/contract";

import { useReportDeviceCalibrationWrite } from "./useReportDeviceCalibrationWrite";

const CALIBRATION_ID = "44444444-4444-4444-8444-444444444444";

describe("useReportDeviceCalibrationWrite", () => {
  it("records per-block write results against the applied calibration", async () => {
    const spy = server.mount(contract.iot.reportDeviceCalibrationWrite, {
      body: createDeviceCalibration({
        id: CALIBRATION_ID,
        writtenToDeviceAt: "2026-09-01T10:06:00.000Z",
        writeResults: { par: { verified: true } },
      }),
    });

    const { result } = renderHook(() => useReportDeviceCalibrationWrite());
    const calibration = await result.current.mutateAsync({
      calibrationId: CALIBRATION_ID,
      writeResults: { par: { verified: true } },
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(calibration.writtenToDeviceAt).not.toBeNull();
    expect(spy.params.calibrationId).toBe(CALIBRATION_ID);
  });
});
