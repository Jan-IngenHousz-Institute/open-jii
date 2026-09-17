import { orpc } from "@/lib/orpc";
import { server } from "@/test/msw/server";
import { renderHook, waitFor, act, createTestQueryClient } from "@/test/test-utils";
import { describe, it, expect, vi } from "vitest";

import { contract } from "@repo/api/contract";

import { useSetCalibrationDefinitionVisibility } from "./useSetCalibrationDefinitionVisibility";

const DEFINITION_ID = "3d0f0f6f-4d4e-4a0e-9a2d-6d1b1b9a0c11";

describe("useSetCalibrationDefinitionVisibility", () => {
  it("sends the publish request for the definition it is given", async () => {
    const spy = server.mount(contract.iot.setCalibrationDefinitionVisibility, {
      body: { id: DEFINITION_ID, visibility: "public" },
    });

    const { result } = renderHook(() => useSetCalibrationDefinitionVisibility());

    act(() => {
      result.current.mutate({ definitionId: DEFINITION_ID, visibility: "public" });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(spy.called).toBe(true);
  });

  // Publishing makes the definition reachable by people who hold no grant on it, so the
  // listing and global search have to be refetched alongside the definition itself.
  it("invalidates the definition, the library listing and global search", async () => {
    server.mount(contract.iot.setCalibrationDefinitionVisibility, {
      body: { id: DEFINITION_ID, visibility: "public" },
    });

    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useSetCalibrationDefinitionVisibility(), { queryClient });

    act(() => {
      result.current.mutate({ definitionId: DEFINITION_ID, visibility: "public" });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: orpc.iot.getCalibrationDefinition.key({
          input: { definitionId: DEFINITION_ID },
        }),
      }),
    );
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: orpc.iot.listCalibrationDefinitions.key() }),
    );
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: orpc.search.globalSearch.key() }),
    );
  });

  it("invalidates even when the request fails, so a refused publish cannot stick locally", async () => {
    server.mount(contract.iot.setCalibrationDefinitionVisibility, { status: 403 });

    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useSetCalibrationDefinitionVisibility(), { queryClient });

    act(() => {
      result.current.mutate({ definitionId: DEFINITION_ID, visibility: "public" });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: orpc.iot.listCalibrationDefinitions.key() }),
    );
  });
});
