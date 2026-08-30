import { server } from "@/test/msw/server";
import { renderHook, waitFor } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { contract } from "@repo/api/contract";

import { useMyScopedMetrics } from "./useMyScopedMetrics";

const scoped = {
  scope: "mine" as const,
  scoped: {
    measurements30d: 4_120,
    activeExperiments30d: 3,
    contributors30d: 5,
    activity: [{ date: "2026-08-30", measurements: 12 }],
    lastActivityDate: "2026-08-30",
  },
  baseline: { measurements30d: 18_439_869, activeExperiments30d: 11 },
  computedAt: "2026-08-30T12:48:55.000Z",
};

describe("useMyScopedMetrics", () => {
  it("asks for the caller's own scope", async () => {
    const spy = server.mount(contract.metrics.getScopedMetrics, { body: scoped });

    const { result } = renderHook(() => useMyScopedMetrics());

    await waitFor(() => {
      expect(result.current.data?.scoped?.measurements30d).toBe(4_120);
    });
    expect(spy.calls[spy.calls.length - 1]?.query?.scope).toBe("mine");
  });

  it("passes through the null slots a lagging warehouse returns", async () => {
    server.mount(contract.metrics.getScopedMetrics, {
      body: { scope: "mine", scoped: null, baseline: null, computedAt: null },
    });

    const { result } = renderHook(() => useMyScopedMetrics());

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    expect(result.current.data?.scoped).toBeNull();
    expect(result.current.isError).toBe(false);
  });
});
