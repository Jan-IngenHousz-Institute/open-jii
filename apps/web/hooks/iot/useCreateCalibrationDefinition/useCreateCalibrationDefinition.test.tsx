import { useAllCalibrationDefinitions } from "@/hooks/iot/useAllCalibrationDefinitions/useAllCalibrationDefinitions";
import { createCalibrationDefinition, createCalibrationDefinitionSummary } from "@/test/factories";
import { server } from "@/test/msw/server";
import { renderHook, waitFor } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";

import { useCreateCalibrationDefinition } from "./useCreateCalibrationDefinition";

/** What the library sends: a family, a name, and a procedure that already runs. */
function newDefinitionBody() {
  const { family, name, captureProcedure, script, outputSchema } = createCalibrationDefinition();
  return { family, name, captureProcedure, script, outputSchema };
}

describe("useCreateCalibrationDefinition", () => {
  it("hands the created definition to the caller, which navigates to it", async () => {
    const definition = createCalibrationDefinition({ name: "Untitled calibration" });
    server.mount(contract.iot.createCalibrationDefinition, { status: 201, body: definition });
    const onSuccess = vi.fn();

    const { result } = renderHook(() => useCreateCalibrationDefinition({ onSuccess }));
    result.current.mutate(newDefinitionBody());

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith(expect.objectContaining({ id: definition.id }));
    });
  });

  // The library the author came from is the list this definition belongs in. Without the
  // invalidation they land on the new definition and find the list still without it.
  it("refetches the library so the new definition is in it", async () => {
    const list = server.mount(contract.iot.listCalibrationDefinitions, {
      body: [createCalibrationDefinitionSummary()],
    });
    server.mount(contract.iot.createCalibrationDefinition, {
      status: 201,
      body: createCalibrationDefinition(),
    });

    const { result } = renderHook(() => ({
      list: useAllCalibrationDefinitions(),
      create: useCreateCalibrationDefinition(),
    }));

    await waitFor(() => {
      expect(result.current.list.data).toHaveLength(1);
    });
    const before = list.calls.length;

    result.current.create.mutate(newDefinitionBody());

    await waitFor(() => {
      expect(list.calls.length).toBeGreaterThan(before);
    });
  });

  it("reports a refused create rather than calling back", async () => {
    server.mount(contract.iot.createCalibrationDefinition, { status: 400 });
    const onSuccess = vi.fn();

    const { result } = renderHook(() => useCreateCalibrationDefinition({ onSuccess }));
    result.current.mutate(newDefinitionBody());

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(onSuccess).not.toHaveBeenCalled();
  });
});
