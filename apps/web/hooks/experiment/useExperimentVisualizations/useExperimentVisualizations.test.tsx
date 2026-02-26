import { createVisualization, resetFactories } from "@/test/factories";
import { server } from "@/test/msw/server";
import { renderHook, waitFor, act } from "@/test/test-utils";
import { describe, it, expect, beforeEach } from "vitest";

import { contract } from "@repo/api";

import { useExperimentVisualizations } from "./useExperimentVisualizations";

describe("useExperimentVisualizations", () => {
  beforeEach(() => {
    resetFactories();
  });

  it("should return visualizations data", async () => {
    const visualizations = [
      createVisualization({ experimentId: "exp-123", chartFamily: "basic", chartType: "line" }),
      createVisualization({ experimentId: "exp-123", chartFamily: "basic", chartType: "scatter" }),
    ];

    server.mount(contract.experiments.listExperimentVisualizations, {
      body: visualizations,
    });

    const { result } = renderHook(() => useExperimentVisualizations({ experimentId: "exp-123" }));

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data?.body).toHaveLength(2);
    expect(result.current.error).toBeNull();
  });

  it("should handle error state", async () => {
    server.mount(contract.experiments.listExperimentVisualizations, { status: 500 });

    const { result } = renderHook(() => useExperimentVisualizations({ experimentId: "exp-123" }));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).not.toBeNull();
  });

  it("should handle empty visualizations list", async () => {
    server.mount(contract.experiments.listExperimentVisualizations, { body: [] });

    const { result } = renderHook(() => useExperimentVisualizations({ experimentId: "exp-123" }));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data?.body).toEqual([]);
  });

  describe("chartFamily filter", () => {
    it("should allow setting chart family filter", async () => {
      server.mount(contract.experiments.listExperimentVisualizations, { body: [] });

      const { result } = renderHook(() => useExperimentVisualizations({ experimentId: "exp-123" }));

      expect(result.current.chartFamily).toBeUndefined();

      act(() => {
        result.current.setChartFamily("basic");
      });

      expect(result.current.chartFamily).toBe("basic");
    });
  });

  describe("pagination", () => {
    it("should have correct initial pagination state", async () => {
      server.mount(contract.experiments.listExperimentVisualizations, { body: [] });

      const { result } = renderHook(() => useExperimentVisualizations({ experimentId: "exp-123" }));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.limit).toBe(50);
      expect(result.current.offset).toBe(0);
      expect(result.current.hasPreviousPage).toBe(false);
      expect(result.current.hasNextPage).toBe(false);
    });

    it("should detect next page when results equal limit", async () => {
      const visualizations = Array.from({ length: 50 }, (_, i) =>
        createVisualization({ experimentId: "exp-123" }),
      );

      server.mount(contract.experiments.listExperimentVisualizations, {
        body: visualizations,
      });

      const { result } = renderHook(() => useExperimentVisualizations({ experimentId: "exp-123" }));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.hasNextPage).toBe(true);
    });

    it("should not have next page when results less than limit", async () => {
      const visualizations = Array.from({ length: 25 }, () =>
        createVisualization({ experimentId: "exp-123" }),
      );

      server.mount(contract.experiments.listExperimentVisualizations, {
        body: visualizations,
      });

      const { result } = renderHook(() => useExperimentVisualizations({ experimentId: "exp-123" }));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.hasNextPage).toBe(false);
    });

    it("should go to next page", async () => {
      const visualizations = Array.from({ length: 50 }, () =>
        createVisualization({ experimentId: "exp-123" }),
      );

      server.mount(contract.experiments.listExperimentVisualizations, {
        body: visualizations,
      });

      const { result } = renderHook(() => useExperimentVisualizations({ experimentId: "exp-123" }));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.nextPage();
      });

      expect(result.current.offset).toBe(50);
      expect(result.current.hasPreviousPage).toBe(true);
    });

    it("should not go to next page when hasNextPage is false", async () => {
      server.mount(contract.experiments.listExperimentVisualizations, { body: [] });

      const { result } = renderHook(() => useExperimentVisualizations({ experimentId: "exp-123" }));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.nextPage();
      });

      expect(result.current.offset).toBe(0);
    });

    it("should go to previous page", async () => {
      server.mount(contract.experiments.listExperimentVisualizations, { body: [] });

      const { result } = renderHook(() =>
        useExperimentVisualizations({
          experimentId: "exp-123",
          initialOffset: 50,
        }),
      );

      expect(result.current.offset).toBe(50);

      act(() => {
        result.current.previousPage();
      });

      expect(result.current.offset).toBe(0);
    });

    it("should not go to previous page when offset is 0", async () => {
      server.mount(contract.experiments.listExperimentVisualizations, { body: [] });

      const { result } = renderHook(() => useExperimentVisualizations({ experimentId: "exp-123" }));

      act(() => {
        result.current.previousPage();
      });

      expect(result.current.offset).toBe(0);
    });

    it("should reset pagination", async () => {
      server.mount(contract.experiments.listExperimentVisualizations, { body: [] });

      const { result } = renderHook(() =>
        useExperimentVisualizations({
          experimentId: "exp-123",
          initialOffset: 100,
        }),
      );

      expect(result.current.offset).toBe(100);

      act(() => {
        result.current.resetPagination();
      });

      expect(result.current.offset).toBe(0);
    });

    it("should allow setting custom limit", async () => {
      server.mount(contract.experiments.listExperimentVisualizations, { body: [] });

      const { result } = renderHook(() => useExperimentVisualizations({ experimentId: "exp-123" }));

      act(() => {
        result.current.setLimit(25);
      });

      expect(result.current.limit).toBe(25);
    });

    it("should allow setting custom offset", async () => {
      server.mount(contract.experiments.listExperimentVisualizations, { body: [] });

      const { result } = renderHook(() => useExperimentVisualizations({ experimentId: "exp-123" }));

      act(() => {
        result.current.setOffset(75);
      });

      expect(result.current.offset).toBe(75);
      expect(result.current.hasPreviousPage).toBe(true);
    });
  });
});
