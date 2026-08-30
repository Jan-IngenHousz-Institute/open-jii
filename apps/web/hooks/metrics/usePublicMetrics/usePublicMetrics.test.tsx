import { server } from "@/test/msw/server";
import { renderHook, waitFor } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { contract } from "@repo/api/contract";

import { usePublicMetrics } from "./usePublicMetrics";

const snapshot = {
  hero: { totalMeasurements: 36_950_000, totalVolumeBytes: 35_300_000_000, timezonesSpanned: 6 },
  liveness: { lastMeasurementAt: "2026-08-30T10:00:00.000Z", measurements24h: 483_691 },
  community: {
    measurements30d: 18_439_869,
    activeExperiments30d: 11,
    contributors30d: 6,
    institutions30d: 5,
  },
  activity: [
    { date: "2026-08-30", measurements: 12, cumulativeMeasurements: 12, volumeBytes: 900 },
  ],
  hourly: [],
  families: [],
  derivedParameter: null,
  sensorParameter: null,
  captions: [],
  computedAt: "2026-08-30T12:48:55.000Z",
};

describe("usePublicMetrics", () => {
  it("returns the public snapshot", async () => {
    server.mount(contract.metrics.getPublicMetrics, { body: snapshot });

    const { result } = renderHook(() => usePublicMetrics());

    await waitFor(() => {
      expect(result.current.data?.hero?.totalMeasurements).toBe(36_950_000);
    });
    expect(result.current.data?.community?.institutions30d).toBe(5);
  });

  it("reports an empty snapshot as data, not as an error", async () => {
    server.mount(contract.metrics.getPublicMetrics, {
      body: {
        ...snapshot,
        hero: null,
        liveness: null,
        community: null,
        activity: [],
        computedAt: null,
      },
    });

    const { result } = renderHook(() => usePublicMetrics());

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    expect(result.current.isError).toBe(false);
    expect(result.current.data?.hero).toBeNull();
  });
});
