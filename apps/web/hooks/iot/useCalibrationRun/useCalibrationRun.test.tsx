import { createCalibrationRun } from "@/test/factories";
import { server } from "@/test/msw/server";
import { renderHook, waitFor } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { contract } from "@repo/api/contract";

import { useCalibrationRun } from "./useCalibrationRun";

const RUN_ID = "33333333-3333-4333-8333-333333333333";

describe("useCalibrationRun", () => {
  it("reads one run", async () => {
    const spy = server.mount(contract.iot.getCalibrationRun, {
      body: createCalibrationRun({ id: RUN_ID }),
    });

    const { result } = renderHook(() => useCalibrationRun(RUN_ID));

    await waitFor(() => {
      expect(result.current.data?.status).toBe("computed");
    });
    expect(spy.params.runId).toBe(RUN_ID);
  });

  it("stays put with no run chosen", async () => {
    const spy = server.mount(contract.iot.getCalibrationRun, { body: createCalibrationRun() });

    const { result } = renderHook(() => useCalibrationRun(null));

    await waitFor(() => {
      expect(result.current.fetchStatus).toBe("idle");
    });
    expect(spy.called).toBe(false);
  });
});
