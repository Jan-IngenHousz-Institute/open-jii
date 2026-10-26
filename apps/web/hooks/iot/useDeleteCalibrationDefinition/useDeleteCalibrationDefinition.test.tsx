import { server } from "@/test/msw/server";
import { renderHook, waitFor, act } from "@/test/test-utils";
import { describe, it, expect, vi } from "vitest";

import { contract } from "@repo/api/contract";

import { useDeleteCalibrationDefinition } from "./useDeleteCalibrationDefinition";

const DEFINITION_ID = "11111111-1111-4111-8111-111111111111";

describe("useDeleteCalibrationDefinition", () => {
  it("deletes the definition and calls onSuccess", async () => {
    const spy = server.mount(contract.iot.deleteCalibrationDefinition, { status: 204 });

    const onSuccess = vi.fn();
    const { result } = renderHook(() => useDeleteCalibrationDefinition({ onSuccess }));

    act(() => {
      result.current.mutate({ definitionId: DEFINITION_ID });
    });

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalled();
    });
    expect(spy.calls).toHaveLength(1);
    expect(spy.params.definitionId).toBe(DEFINITION_ID);
  });

  // The server refuses a definition a run recorded; the caller has to hear about it.
  it("surfaces a refusal", async () => {
    server.mount(contract.iot.deleteCalibrationDefinition, { status: 400 });

    const onSuccess = vi.fn();
    const { result } = renderHook(() => useDeleteCalibrationDefinition({ onSuccess }));

    act(() => {
      result.current.mutate({ definitionId: DEFINITION_ID });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(onSuccess).not.toHaveBeenCalled();
  });
});
