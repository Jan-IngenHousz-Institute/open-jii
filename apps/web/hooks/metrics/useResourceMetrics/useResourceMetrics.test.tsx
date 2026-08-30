import { server } from "@/test/msw/server";
import { renderHook, waitFor } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { contract } from "@repo/api/contract";

import { useResourceMetrics } from "./useResourceMetrics";

const totals = (kind: "protocol" | "macro") => ({
  kind,
  totalMeasurements: 60,
  activeCount: 1,
  windowDays: 30,
  computedAt: null,
});

describe("useResourceMetrics", () => {
  it("returns the totals a list header states", async () => {
    server.mount(contract.metrics.getResourceMetrics, { body: totals("protocol") });

    const { result } = renderHook(() => useResourceMetrics("protocol"));

    await waitFor(() => {
      expect(result.current.data?.totalMeasurements).toBe(60);
    });
    expect(result.current.data?.activeCount).toBe(1);
  });

  it("asks for the kind it was given", async () => {
    const spy = server.mount(contract.metrics.getResourceMetrics, { body: totals("macro") });

    const { result } = renderHook(() => useResourceMetrics("macro"));

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    expect(spy.calls[spy.calls.length - 1]?.query?.kind).toBe("macro");
  });

  it("surfaces an unavailable endpoint as an error rather than stale data", async () => {
    server.mount(contract.metrics.getResourceMetrics, { status: 500 });

    const { result } = renderHook(() => useResourceMetrics("protocol"));

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.data).toBeUndefined();
  });
});
