import { createCalibrationDefinitionSummary } from "@/test/factories";
import { server } from "@/test/msw/server";
import { renderHook, waitFor } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { contract } from "@repo/api/contract";

import { useCalibrationDefinitions } from "./useCalibrationDefinitions";

describe("useCalibrationDefinitions", () => {
  it("lists the definitions for a family", async () => {
    const spy = server.mount(contract.iot.listCalibrationDefinitions, {
      body: [createCalibrationDefinitionSummary({ family: "minipar" })],
    });

    const { result } = renderHook(() => useCalibrationDefinitions("minipar"));

    await waitFor(() => {
      expect(result.current.data).toHaveLength(1);
    });
    expect(spy.calls[0].query.family).toBe("minipar");
  });

  // The device's family arrives with the device; nothing is asked before then.
  it("stays put until a family is known", async () => {
    const spy = server.mount(contract.iot.listCalibrationDefinitions, { body: [] });

    const { result } = renderHook(() => useCalibrationDefinitions(undefined));

    await waitFor(() => {
      expect(result.current.fetchStatus).toBe("idle");
    });
    expect(spy.called).toBe(false);
  });

  it("surfaces a failure", async () => {
    server.mount(contract.iot.listCalibrationDefinitions, { status: 500 });

    const { result } = renderHook(() => useCalibrationDefinitions("minipar"));

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});
