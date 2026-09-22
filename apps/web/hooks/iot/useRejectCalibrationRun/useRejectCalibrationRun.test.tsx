import { createCalibrationRun } from "@/test/factories";
import { server } from "@/test/msw/server";
import { renderHook, waitFor } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { contract } from "@repo/api/contract";

import { useRejectCalibrationRun } from "./useRejectCalibrationRun";

const RUN_ID = "33333333-3333-4333-8333-333333333333";

describe("useRejectCalibrationRun", () => {
  it("rejects a run and receives it back as rejected", async () => {
    const spy = server.mount(contract.iot.rejectCalibrationRun, {
      body: createCalibrationRun({ id: RUN_ID, status: "rejected" }),
    });

    const { result } = renderHook(() => useRejectCalibrationRun());
    const run = await result.current.mutateAsync({ runId: RUN_ID });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(run.status).toBe("rejected");
    expect(spy.params.runId).toBe(RUN_ID);
  });
});
