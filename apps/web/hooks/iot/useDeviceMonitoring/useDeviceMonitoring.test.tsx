import { server } from "@/test/msw/server";
import { renderHook, waitFor } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { contract } from "@repo/api/contract";
import type { DeviceMonitoring } from "@repo/api/domains/iot/iot.schema";

import { useDeviceMonitoring } from "./useDeviceMonitoring";

const DEVICE_ID = "11111111-1111-4111-8111-111111111111";

const monitoring: DeviceMonitoring = {
  bucket: "hour",
  events: [],
  sessions: [],
  uptimePercent: null,
  truncated: false,
  throughput: [],
  battery: [],
  payload: {
    totalMeasurements: 0,
    withGps: 0,
    withBattery: 0,
    workbookRuns: 0,
    firmwareMix: [],
    protocolMix: [],
  },
};

describe("useDeviceMonitoring", () => {
  it("queries the resolved window and exposes it alongside the data", async () => {
    const spy = server.mount(contract.iot.getDeviceMonitoring, { body: monitoring });

    const { result } = renderHook(() => useDeviceMonitoring(DEVICE_ID, "24h"));

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    expect(result.current.range.bucket).toBe("hour");
    const query = spy.calls[0].query;
    expect(query.bucket).toBe("hour");
    expect(query.from).toBe(result.current.range.from);
    expect(query.to).toBe(result.current.range.to);
  });

  it("switches to daily buckets for the week preset", async () => {
    server.mount(contract.iot.getDeviceMonitoring, { body: { ...monitoring, bucket: "day" } });

    const { result } = renderHook(() => useDeviceMonitoring(DEVICE_ID, "7d"));

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    expect(result.current.range.bucket).toBe("day");
  });
});
