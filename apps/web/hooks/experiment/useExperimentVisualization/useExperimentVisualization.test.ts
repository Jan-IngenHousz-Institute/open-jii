import { createVisualization } from "@/test/factories";
import { server } from "@/test/msw/server";
import { renderHook, waitFor } from "@/test/test-utils";
import { describe, it, expect } from "vitest";

import { contract } from "@repo/api";

import { useExperimentVisualization } from "./useExperimentVisualization";

describe("useExperimentVisualization", () => {
  it("returns visualization data on success", async () => {
    const visualization = createVisualization();
    server.mount(contract.experiments.getExperimentVisualization, {
      body: visualization,
    });

    const { result } = renderHook(() =>
      useExperimentVisualization(visualization.id, visualization.experimentId),
    );

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    expect(result.current.data?.body).toMatchObject({
      id: visualization.id,
      name: visualization.name,
      chartFamily: visualization.chartFamily,
      chartType: visualization.chartType,
    });
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("passes correct path params", async () => {
    const visualization = createVisualization();
    const spy = server.mount(contract.experiments.getExperimentVisualization, {
      body: visualization,
    });

    const { result } = renderHook(() =>
      useExperimentVisualization(visualization.id, visualization.experimentId),
    );

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    expect(spy.params.id).toBe(visualization.experimentId);
    expect(spy.params.visualizationId).toBe(visualization.id);
  });

  it("handles 404 error", async () => {
    server.mount(contract.experiments.getExperimentVisualization, { status: 404 });

    const { result } = renderHook(() => useExperimentVisualization("bad-viz", "bad-exp"));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data?.body).toBeUndefined();
  });
});
