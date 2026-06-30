import { createVisualization } from "@/test/factories";
import { server } from "@/test/msw/server";
import { renderHook, waitFor, act } from "@/test/test-utils";
import { describe, it, expect, vi } from "vitest";

import { orpcContract } from "@repo/api/orpc-contract";

import { useExperimentVisualizationUpdate } from "./useExperimentVisualizationUpdate";

const baseBody = {
  chartFamily: "basic" as const,
  chartType: "line" as const,
  dataConfig: {
    tableName: "test_table",
    dataSources: [
      { tableName: "test_table", columnName: "time", role: "x" as const },
      { tableName: "test_table", columnName: "value", role: "y" as const },
    ],
  },
};

describe("useExperimentVisualizationUpdate", () => {
  it("sends PATCH request", async () => {
    const viz = createVisualization({ id: "viz-1", experimentId: "exp-1" });
    const spy = server.mount(orpcContract.experiments.updateExperimentVisualization, { body: viz });

    const { result } = renderHook(() =>
      useExperimentVisualizationUpdate({ experimentId: "exp-1" }),
    );

    act(() => {
      result.current.mutate({
        id: "exp-1",
        visualizationId: "viz-1",
        name: "Updated Viz",
        ...baseBody,
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
    const spy = server.mount(orpcContract.experiments.updateExperimentVisualization, { body: viz });

    const { result } = renderHook(() =>
      useExperimentVisualizationUpdate({ experimentId: "exp-1" }),
    );

    act(() => {
      result.current.mutate({
        id: "exp-1",
        visualizationId: "viz-1",
        ...baseBody,
        name: "Updated",
        chartType: "scatter",
      });
    });

    await waitFor(() => {
      expect(spy.body).toMatchObject({ name: "Updated", chartType: "scatter" });
    });
  });

  it("calls onSuccess callback with visualization data", async () => {
    const viz = createVisualization({ id: "viz-1", experimentId: "exp-1", name: "Updated" });
    server.mount(orpcContract.experiments.updateExperimentVisualization, { body: viz });

    const onSuccess = vi.fn();
    const { result } = renderHook(() =>
      useExperimentVisualizationUpdate({ experimentId: "exp-1", onSuccess }),
    );

    act(() => {
      result.current.mutate({
        id: "exp-1",
        visualizationId: "viz-1",
        name: "Updated",
        ...baseBody,
      });
    });

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith(expect.objectContaining({ id: "viz-1" }));
    });
  });

  it("handles error response", async () => {
    server.mount(orpcContract.experiments.updateExperimentVisualization, { status: 500 });

    const { result } = renderHook(() =>
      useExperimentVisualizationUpdate({ experimentId: "exp-1" }),
    );

    act(() => {
      result.current.mutate({
        id: "exp-1",
        visualizationId: "viz-1",
        name: "Fail",
        ...baseBody,
      });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});
