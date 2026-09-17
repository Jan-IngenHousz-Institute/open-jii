import { createCalibrationRun } from "@/test/factories";
import { server } from "@/test/msw/server";
import { renderHook, waitFor } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { contract } from "@repo/api/contract";

import { useDeviceCalibrationRuns } from "./useDeviceCalibrationRuns";

const DEVICE_ID = "11111111-1111-4111-8111-111111111111";

describe("useDeviceCalibrationRuns", () => {
  it("lists a device's runs", async () => {
    const spy = server.mount(contract.iot.listDeviceCalibrationRuns, {
      body: [createCalibrationRun({ deviceId: DEVICE_ID })],
    });

    const { result } = renderHook(() => useDeviceCalibrationRuns(DEVICE_ID));

    await waitFor(() => {
      expect(result.current.data).toHaveLength(1);
    });
    expect(spy.params.deviceId).toBe(DEVICE_ID);
  });

  it("surfaces a failure", async () => {
    server.mount(contract.iot.listDeviceCalibrationRuns, { status: 500 });

    const { result } = renderHook(() => useDeviceCalibrationRuns(DEVICE_ID));

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});
