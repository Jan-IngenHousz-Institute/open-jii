import { createVisualization } from "@/test/factories";
import { server } from "@/test/msw/server";
import { renderHook, waitFor, act } from "@/test/test-utils";
import { describe, it, expect, vi } from "vitest";

import { contract } from "@repo/api";

import { useExperimentVisualizationUpdate } from "./useExperimentVisualizationUpdate";

describe("useExperimentVisualizationUpdate", () => {
  it("sends PATCH request", async () => {
    const viz = createVisualization({ id: "viz-1", experimentId: "exp-1" });
    const spy = server.mount(contract.experiments.updateExperimentVisualization, { body: viz });

    const { result } = renderHook(() =>
      useExperimentVisualizationUpdate({ experimentId: "exp-1" }),
    );

    act(() => {
      result.current.mutate({
        params: { id: "exp-1", visualizationId: "viz-1" },
        body: { name: "Updated Viz" },
      });
    });

    await waitFor(() => {
      expect(spy.called).toBe(true);
      expect(spy.params.id).toBe("exp-1");
      expect(spy.params.visualizationId).toBe("viz-1");
    });
  });

  it("sends correct body", async () => {
    const viz = createVisualization({ id: "viz-1", experimentId: "exp-1", name: "Updated" });
    const spy = server.mount(contract.experiments.updateExperimentVisualization, { body: viz });

    const { result } = renderHook(() =>
      useExperimentVisualizationUpdate({ experimentId: "exp-1" }),
    );

    act(() => {
      result.current.mutate({
        params: { id: "exp-1", visualizationId: "viz-1" },
        body: { name: "Updated", chartType: "scatter" },
      });
    });

    await waitFor(() => {
      expect(spy.body).toMatchObject({ name: "Updated", chartType: "scatter" });
    });
  });

  it("calls onSuccess callback with visualization data", async () => {
    const viz = createVisualization({ id: "viz-1", experimentId: "exp-1", name: "Updated" });
    server.mount(contract.experiments.updateExperimentVisualization, { body: viz });

    const onSuccess = vi.fn();
    const { result } = renderHook(() =>
      useExperimentVisualizationUpdate({ experimentId: "exp-1", onSuccess }),
    );

    act(() => {
      result.current.mutate({
        params: { id: "exp-1", visualizationId: "viz-1" },
        body: { name: "Updated" },
      });
    });

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith(expect.objectContaining({ id: "viz-1" }));
    });
  });

  it("handles error response", async () => {
    server.mount(contract.experiments.updateExperimentVisualization, { status: 500 });

    const { result } = renderHook(() =>
      useExperimentVisualizationUpdate({ experimentId: "exp-1" }),
    );

    act(() => {
      result.current.mutate({
        params: { id: "exp-1", visualizationId: "viz-1" },
        body: { name: "Fail" },
      });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});
