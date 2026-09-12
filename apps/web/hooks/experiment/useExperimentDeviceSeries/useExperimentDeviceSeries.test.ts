import { server } from "@/test/msw/server";
import { renderHook, waitFor } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { contract } from "@repo/api/contract";

import { useExperimentDeviceSeries } from "./useExperimentDeviceSeries";

const EXPERIMENT_ID = "00000000-0000-0000-0000-0000000000aa";

const input = {
  experimentId: EXPERIMENT_ID,
  clientId: "AMBYTE_28:37:2F:FF:E7:04",
  from: "2026-09-01T00:00:00.000Z",
  to: "2026-09-04T00:00:00.000Z",
};

describe("useExperimentDeviceSeries", () => {
  it("returns the device's buckets for the experiment", async () => {
    server.mount(contract.experiments.getExperimentDeviceSeries, {
      body: {
        buckets: [{ bucketStart: "2026-09-01T00:00:00.000Z", count: 12 }],
        pipelineUnavailable: false,
      },
    });

    const { result } = renderHook(() => useExperimentDeviceSeries(input));

    await waitFor(() => {
      expect(result.current.data?.buckets).toEqual([
        { bucketStart: "2026-09-01T00:00:00.000Z", count: 12 },
      ]);
    });
  });

  it("sends the client id as a query parameter, since it carries colons", async () => {
    const spy = server.mount(contract.experiments.getExperimentDeviceSeries, {
      body: { buckets: [], pipelineUnavailable: false },
    });

    const { result } = renderHook(() => useExperimentDeviceSeries(input));

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(spy.calls[0].query).toMatchObject({
      clientId: input.clientId,
      from: input.from,
      to: input.to,
      bucket: "day",
    });
  });

  it("surfaces the warehouse's own unavailability as a successful read", async () => {
    server.mount(contract.experiments.getExperimentDeviceSeries, {
      body: { buckets: [], pipelineUnavailable: true },
    });

    const { result } = renderHook(() => useExperimentDeviceSeries(input));

    await waitFor(() => {
      expect(result.current.data?.pipelineUnavailable).toBe(true);
    });
    expect(result.current.isError).toBe(false);
  });

  it("reports a failed request as an error rather than an empty series", async () => {
    server.mount(contract.experiments.getExperimentDeviceSeries, { status: 500 });

    const { result } = renderHook(() => useExperimentDeviceSeries(input));

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.data).toBeUndefined();
  });

  it("handles loading state", () => {
    server.mount(contract.experiments.getExperimentDeviceSeries, {
      body: { buckets: [], pipelineUnavailable: false },
      delay: 999_999,
    });

    const { result } = renderHook(() => useExperimentDeviceSeries(input));

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();
  });
});
