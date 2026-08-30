import { server } from "@/test/msw/server";
import { renderHook, waitFor } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { contract } from "@repo/api/contract";

import { useExperimentMetrics } from "./useExperimentMetrics";

const scoped = {
  scope: "experiment" as const,
  scoped: {
    measurements30d: 4_519,
    activeExperiments30d: 1,
    contributors30d: 0,
    activity: [{ date: "2026-08-30", measurements: 4_519 }],
    lastActivityDate: "2026-08-30",
  },
  baseline: { measurements30d: 18_439_869, activeExperiments30d: 11 },
  computedAt: "2026-08-30T12:48:55.000Z",
};

describe("useExperimentMetrics", () => {
  it("scopes the request to the experiment it was given", async () => {
    const spy = server.mount(contract.metrics.getScopedMetrics, { body: scoped });

    const { result } = renderHook(() => useExperimentMetrics("exp-1"));

    await waitFor(() => {
      expect(result.current.data?.scoped?.measurements30d).toBe(4_519);
    });

    const call = spy.calls[spy.calls.length - 1];
    expect(call.query.scope).toBe("experiment");
    expect(call.query.experimentId).toBe("exp-1");
  });

  it("surfaces a refusal as an error rather than empty activity", async () => {
    server.mount(contract.metrics.getScopedMetrics, { status: 403 });

    const { result } = renderHook(() => useExperimentMetrics("exp-1"));

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.data).toBeUndefined();
  });
});
