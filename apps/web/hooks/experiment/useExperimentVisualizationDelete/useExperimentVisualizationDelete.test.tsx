import { server } from "@/test/msw/server";
import { renderHook, waitFor, act } from "@/test/test-utils";
import { describe, it, expect, vi } from "vitest";

import { orpcContract } from "@repo/api/orpc-contract";

import { useExperimentVisualizationDelete } from "./useExperimentVisualizationDelete";

describe("useExperimentVisualizationDelete", () => {
  it("sends DELETE request", async () => {
    const spy = server.mount(orpcContract.experiments.deleteExperimentVisualization);

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
    server.mount(orpcContract.experiments.deleteExperimentVisualization);

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
    server.mount(orpcContract.experiments.deleteExperimentVisualization, { status: 500 });

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
});
