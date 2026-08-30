import { server } from "@/test/msw/server";
import { renderHook, waitFor } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { contract } from "@repo/api/contract";

import { useResourceActivity } from "./useResourceActivity";

const activity = (kind: "protocol" | "macro") => ({
  kind,
  resources: [
    {
      id: "r-1",
      measurements: 60,
      days: [
        { date: "2026-08-27", measurements: 20 },
        { date: "2026-08-28", measurements: 40 },
      ],
    },
  ],
  totalMeasurements: 60,
  activeCount: 1,
  windowDays: 30,
  computedAt: null,
});

describe("useResourceActivity", () => {
  it("returns the daily series per resource", async () => {
    server.mount(contract.metrics.getResourceActivity, { body: activity("protocol") });

    const { result } = renderHook(() => useResourceActivity("protocol"));

    await waitFor(() => {
      expect(result.current.data?.resources).toHaveLength(1);
    });

    expect(result.current.data?.resources[0]?.days).toHaveLength(2);
    expect(result.current.data?.totalMeasurements).toBe(60);
  });

  it("asks for the kind it was given", async () => {
    const spy = server.mount(contract.metrics.getResourceActivity, { body: activity("macro") });

    const { result } = renderHook(() => useResourceActivity("macro"));

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    expect(spy.calls[spy.calls.length - 1]?.query?.kind).toBe("macro");
  });

  it("surfaces an unavailable endpoint as an error rather than stale data", async () => {
    server.mount(contract.metrics.getResourceActivity, { status: 500 });

    const { result } = renderHook(() => useResourceActivity("protocol"));

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.data).toBeUndefined();
  });
});
