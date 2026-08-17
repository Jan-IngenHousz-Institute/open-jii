import { orpc } from "@/lib/orpc";
import { server } from "@/test/msw/server";
import { renderHook, waitFor, act } from "@/test/test-utils";
import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";

import { useExperimentDelete } from "./useExperimentDelete";

const EXPERIMENT_ID = "11111111-1111-4111-8111-111111111111";

describe("useExperimentDelete", () => {
  it("deletes the experiment and refreshes the lists it affects", async () => {
    const spy = server.mount(contract.experiments.deleteExperiment, { status: 204 });
    const queryClient = new QueryClient();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const remove = vi.spyOn(queryClient, "removeQueries");

    const { result } = renderHook(() => useExperimentDelete(), { queryClient });

    act(() => {
      result.current.mutate({ id: EXPERIMENT_ID });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(spy.params.id).toBe(EXPERIMENT_ID);

    expect(remove).toHaveBeenCalledWith({
      queryKey: orpc.experiments.getExperiment.queryKey({ input: { id: EXPERIMENT_ID } }),
    });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: orpc.experiments.listExperiments.key(),
    });
    // Deleting an experiment cascades its device bindings away.
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: orpc.iot.listDeviceExperiments.key(),
    });
  });

  it("surfaces a failed delete", async () => {
    server.mount(contract.experiments.deleteExperiment, { status: 403 });

    const { result } = renderHook(() => useExperimentDelete());

    act(() => {
      result.current.mutate({ id: EXPERIMENT_ID });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});
