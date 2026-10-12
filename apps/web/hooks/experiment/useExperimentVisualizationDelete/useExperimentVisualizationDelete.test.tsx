import { orpc } from "@/lib/orpc";
import { createVisualization } from "@/test/factories";
import { server } from "@/test/msw/server";
import { renderHook, waitFor, act } from "@/test/test-utils";
import { QueryClient } from "@tanstack/react-query";
import { describe, it, expect, vi } from "vitest";

import { contract } from "@repo/api/contract";

import { useExperimentVisualizationDelete } from "./useExperimentVisualizationDelete";

describe("useExperimentVisualizationDelete", () => {
  it("sends DELETE request", async () => {
    const spy = server.mount(contract.experiments.deleteExperimentVisualization);

    const { result } = renderHook(() =>
      useExperimentVisualizationDelete({ experimentId: "exp-1" }),
    );

    act(() => {
      result.current.mutate({
        id: "exp-1",
        visualizationId: "viz-1",
      });
    });

    await waitFor(() => {
      expect(spy.called).toBe(true);
      expect(spy.params.id).toBe("exp-1");
      expect(spy.params.visualizationId).toBe("viz-1");
    });
  });

  it("calls onSuccess callback when provided", async () => {
    server.mount(contract.experiments.deleteExperimentVisualization);

    const onSuccess = vi.fn();
    const { result } = renderHook(() =>
      useExperimentVisualizationDelete({ experimentId: "exp-1", onSuccess }),
    );

    act(() => {
      result.current.mutate({
        id: "exp-1",
        visualizationId: "viz-1",
      });
    });

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalled();
    });
  });

  it("handles error response", async () => {
    server.mount(contract.experiments.deleteExperimentVisualization, { status: 500 });

    const { result } = renderHook(() =>
      useExperimentVisualizationDelete({ experimentId: "exp-1" }),
    );

    act(() => {
      result.current.mutate({
        id: "exp-1",
        visualizationId: "viz-1",
      });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });

  it("drops the row before the server answers and puts it back when the delete fails", async () => {
    const listKey = orpc.experiments.listExperimentVisualizations.queryKey({
      input: { id: "exp-1" },
    });
    // The seeded list has no observer, so it must outlive the default zero gcTime.
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } },
    });
    queryClient.setQueryData(listKey, [
      createVisualization({ id: "viz-1" }),
      createVisualization({ id: "viz-2" }),
    ]);
    server.mount(contract.experiments.deleteExperimentVisualization, { status: 500, delay: 200 });
    const listedIds = () =>
      queryClient.getQueryData<{ id: string }[]>(listKey)?.map((row) => row.id);

    const { result } = renderHook(
      () => useExperimentVisualizationDelete({ experimentId: "exp-1" }),
      { queryClient },
    );
    act(() => {
      result.current.mutate({ id: "exp-1", visualizationId: "viz-1" });
    });

    await waitFor(() => expect(listedIds()).toEqual(["viz-2"]));
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(listedIds()).toEqual(["viz-1", "viz-2"]);
  });
});
