import { createCalibrationRun } from "@/test/factories";
import { server } from "@/test/msw/server";
import { renderHook, waitFor } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { contract } from "@repo/api/contract";

import { useCreateCalibrationRun } from "./useCreateCalibrationRun";

const DEVICE_ID = "11111111-1111-4111-8111-111111111111";
const DEFINITION_ID = "22222222-2222-4222-8222-222222222222";

describe("useCreateCalibrationRun", () => {
  it("submits a payload and receives the finished run", async () => {
    const spy = server.mount(contract.iot.createCalibrationRun, {
      status: 201,
      body: createCalibrationRun({ deviceId: DEVICE_ID, definitionId: DEFINITION_ID }),
    });

    const { result } = renderHook(() => useCreateCalibrationRun());
    const run = await result.current.mutateAsync({
      deviceId: DEVICE_ID,
      definitionId: DEFINITION_ID,
      payload: { par_sweep: [{ stimulus: "bright", par_raw: 420, par_ref: 402.12 }] },
      firmwareVersion: "1.03",
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(run.status).toBe("computed");
    expect(spy.params.deviceId).toBe(DEVICE_ID);
  });

  it("surfaces a rejected submission", async () => {
    server.mount(contract.iot.createCalibrationRun, { status: 400 });

    const { result } = renderHook(() => useCreateCalibrationRun());

    await expect(
      result.current.mutateAsync({
        deviceId: DEVICE_ID,
        definitionId: DEFINITION_ID,
        payload: {},
      }),
    ).rejects.toBeDefined();
  });
});
