import { createDeviceCalibration } from "@/test/factories";
import { server } from "@/test/msw/server";
import { renderHook, waitFor } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { contract } from "@repo/api/contract";

import { useDeviceCalibrations } from "./useDeviceCalibrations";

const DEVICE_ID = "11111111-1111-4111-8111-111111111111";

describe("useDeviceCalibrations", () => {
  it("lists the calibration history", async () => {
    const spy = server.mount(contract.iot.listDeviceCalibrations, {
      body: [
        createDeviceCalibration({ deviceId: DEVICE_ID }),
        createDeviceCalibration({ deviceId: DEVICE_ID, supersededAt: "2026-09-01T10:05:00.000Z" }),
      ],
    });

    const { result } = renderHook(() => useDeviceCalibrations(DEVICE_ID));

    await waitFor(() => {
      expect(result.current.data).toHaveLength(2);
    });
    expect(spy.params.deviceId).toBe(DEVICE_ID);
  });
});
