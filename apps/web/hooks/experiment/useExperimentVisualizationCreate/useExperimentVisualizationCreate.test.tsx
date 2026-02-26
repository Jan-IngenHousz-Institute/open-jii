/**
 * useExperimentVisualizationCreate hook test — MSW-based.
 *
 * The real hook calls `tsr.experiments.createExperimentVisualization.useMutation` →
 * `POST /api/v1/experiments/:id/visualizations`. MSW intercepts that request.
 */
import { createVisualization } from "@/test/factories";
import { server } from "@/test/msw/server";
import { renderHook, waitFor, act } from "@/test/test-utils";
import { describe, it, expect, vi } from "vitest";

import { contract } from "@repo/api";

import { useExperimentVisualizationCreate } from "./useExperimentVisualizationCreate";

describe("useExperimentVisualizationCreate", () => {
  it("sends POST request via MSW", async () => {
    const viz = createVisualization({ experimentId: "exp-1" });
    const spy = server.mount(contract.experiments.createExperimentVisualization, { body: viz });

    const { result } = renderHook(() =>
      useExperimentVisualizationCreate({ experimentId: "exp-1" }),
    );

    act(() => {
      result.current.mutate({
        params: { id: "exp-1" },
        body: {
          name: "New Viz",
          chartFamily: "basic",
          chartType: "line",
          config: {},
          dataConfig: viz.dataConfig,
        },
      });
    });

    await waitFor(() => {
      expect(spy.called).toBe(true);
      expect(spy.params.id).toBe("exp-1");
    });
  });

  it("sends correct body", async () => {
    const viz = createVisualization({ experimentId: "exp-1" });
    const spy = server.mount(contract.experiments.createExperimentVisualization, { body: viz });

    const { result } = renderHook(() =>
      useExperimentVisualizationCreate({ experimentId: "exp-1" }),
    );

    act(() => {
      result.current.mutate({
        params: { id: "exp-1" },
        body: {
          name: "Test Viz",
          chartFamily: "basic",
          chartType: "bar",
          config: {},
          dataConfig: viz.dataConfig,
        },
      });
    });

    await waitFor(() => {
      expect(spy.body).toMatchObject({ name: "Test Viz", chartType: "bar" });
    });
  });

  it("calls onSuccess callback with visualization data", async () => {
    const viz = createVisualization({ id: "viz-1", experimentId: "exp-1" });
    server.mount(contract.experiments.createExperimentVisualization, { body: viz });

    const onSuccess = vi.fn();
    const { result } = renderHook(() =>
      useExperimentVisualizationCreate({ experimentId: "exp-1", onSuccess }),
    );

    act(() => {
      result.current.mutate({
        params: { id: "exp-1" },
        body: {
          name: viz.name,
          chartFamily: "basic",
          chartType: "line",
          config: {},
          dataConfig: viz.dataConfig,
        },
      });
    });

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith(expect.objectContaining({ id: "viz-1" }));
    });
  });

  it("handles error response", async () => {
    server.mount(contract.experiments.createExperimentVisualization, { status: 500 });

    const { result } = renderHook(() =>
      useExperimentVisualizationCreate({ experimentId: "exp-1" }),
    );

    act(() => {
      result.current.mutate({
        params: { id: "exp-1" },
        body: {
          name: "Fail",
          chartFamily: "basic",
          chartType: "line",
          config: {},
          dataConfig: { tableName: "t", dataSources: [] },
        },
      });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});
