import { createDeviceCalibration } from "@/test/factories";
import { server } from "@/test/msw/server";
import { renderHook, waitFor } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { contract } from "@repo/api/contract";

import { useApproveCalibrationRun } from "./useApproveCalibrationRun";

const RUN_ID = "33333333-3333-4333-8333-333333333333";

describe("useApproveCalibrationRun", () => {
  it("approves a run and receives the applied calibration", async () => {
    const spy = server.mount(contract.iot.approveCalibrationRun, {
      status: 201,
      body: createDeviceCalibration({ runId: RUN_ID }),
    });

    const { result } = renderHook(() => useApproveCalibrationRun());
    const applied = await result.current.mutateAsync({ runId: RUN_ID });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(applied.runId).toBe(RUN_ID);
    expect(spy.params.runId).toBe(RUN_ID);
  });
});
