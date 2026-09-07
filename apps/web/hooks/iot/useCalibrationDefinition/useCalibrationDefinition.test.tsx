import { createCalibrationDefinition } from "@/test/factories";
import { server } from "@/test/msw/server";
import { renderHook, waitFor } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { contract } from "@repo/api/contract";

import { useCalibrationDefinition } from "./useCalibrationDefinition";

const DEFINITION_ID = "22222222-2222-4222-8222-222222222222";

describe("useCalibrationDefinition", () => {
  it("reads a definition with its procedure and schema", async () => {
    const spy = server.mount(contract.iot.getCalibrationDefinition, {
      body: createCalibrationDefinition({ id: DEFINITION_ID }),
    });

    const { result } = renderHook(() => useCalibrationDefinition(DEFINITION_ID));

    await waitFor(() => {
      expect(result.current.data?.captureProcedure.steps).toHaveLength(1);
    });
    expect(spy.params.definitionId).toBe(DEFINITION_ID);
  });

  it("stays put with no definition chosen", async () => {
    const spy = server.mount(contract.iot.getCalibrationDefinition, {
      body: createCalibrationDefinition(),
    });

    const { result } = renderHook(() => useCalibrationDefinition(null));

    await waitFor(() => {
      expect(result.current.fetchStatus).toBe("idle");
    });
    expect(spy.called).toBe(false);
  });
});
