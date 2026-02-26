/**
 * useExperimentVisualizationDelete hook test — MSW-based.
 *
 * The real hook calls `tsr.experiments.deleteExperimentVisualization.useMutation` →
 * `DELETE /api/v1/experiments/:id/visualizations/:visualizationId`. MSW intercepts that request.
 */
import { server } from "@/test/msw/server";
import { renderHook, waitFor, act } from "@/test/test-utils";
import { describe, it, expect, vi } from "vitest";

import { contract } from "@repo/api";

import { useExperimentVisualizationDelete } from "./useExperimentVisualizationDelete";

describe("useExperimentVisualizationDelete", () => {
  it("sends DELETE request via MSW", async () => {
    const spy = server.mount(contract.experiments.deleteExperimentVisualization);

    const { result } = renderHook(() =>
      useExperimentVisualizationDelete({ experimentId: "exp-1" }),
    );

    act(() => {
      result.current.mutate({
        params: { id: "exp-1", visualizationId: "viz-1" },
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
        params: { id: "exp-1", visualizationId: "viz-1" },
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
        params: { id: "exp-1", visualizationId: "viz-1" },
      });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});
