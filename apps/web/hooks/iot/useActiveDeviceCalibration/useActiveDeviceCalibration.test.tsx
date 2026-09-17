import { createDeviceCalibration } from "@/test/factories";
import { server } from "@/test/msw/server";
import { renderHook, waitFor } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { contract } from "@repo/api/contract";

import { useActiveDeviceCalibration } from "./useActiveDeviceCalibration";

const DEVICE_ID = "11111111-1111-4111-8111-111111111111";

describe("useActiveDeviceCalibration", () => {
  it("reads the calibration in force", async () => {
    const spy = server.mount(contract.iot.getActiveDeviceCalibration, {
      body: createDeviceCalibration({ deviceId: DEVICE_ID }),
    });

    const { result } = renderHook(() => useActiveDeviceCalibration(DEVICE_ID));

    await waitFor(() => {
      expect(result.current.data?.blocks.par.coefficients.slope).toBe(0.96);
    });
    expect(spy.params.deviceId).toBe(DEVICE_ID);
  });

  // Never calibrated is an answer, not an error.
  it("reads null for a device that was never calibrated", async () => {
    server.mount(contract.iot.getActiveDeviceCalibration, { body: null });

    const { result } = renderHook(() => useActiveDeviceCalibration(DEVICE_ID));

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data).toBeNull();
  });
});
