import { createCalibrationDefinitionSummary } from "@/test/factories";
import { server } from "@/test/msw/server";
import { renderHook, waitFor } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { contract } from "@repo/api/contract";

import { useAllCalibrationDefinitions } from "./useAllCalibrationDefinitions";

describe("useAllCalibrationDefinitions", () => {
  // The library is not looking at a device, so it must not narrow by family the way the
  // device page's sibling hook does.
  it("lists every definition, across families", async () => {
    const spy = server.mount(contract.iot.listCalibrationDefinitions, {
      body: [
        createCalibrationDefinitionSummary({ family: "minipar" }),
        createCalibrationDefinitionSummary({ family: "ambit" }),
      ],
    });

    const { result } = renderHook(() => useAllCalibrationDefinitions());

    await waitFor(() => {
      expect(result.current.data).toHaveLength(2);
    });
    expect(spy.calls[0].query.family).toBeUndefined();
  });

  it("surfaces a failure instead of an empty library", async () => {
    server.mount(contract.iot.listCalibrationDefinitions, { status: 500 });

    const { result } = renderHook(() => useAllCalibrationDefinitions());

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.data).toBeUndefined();
  });
});
