import type { MonitoringRange } from "@/components/iot-devices/monitoring/monitoring-range";
import { server } from "@/test/msw/server";
import { renderHook, waitFor } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { contract } from "@repo/api/contract";
import type { DeviceMonitoring } from "@repo/api/domains/iot/iot.schema";

import { useDeviceMonitoring } from "./useDeviceMonitoring";

const DEVICE_ID = "11111111-1111-4111-8111-111111111111";
const RANGE: MonitoringRange = {
  from: "2026-08-14T10:30:00.000Z",
  to: "2026-08-15T10:30:00.000Z",
  bucket: "hour",
};

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
  it("queries exactly the window it is given", async () => {
    const spy = server.mount(contract.iot.getDeviceMonitoring, { body: monitoring });

    const { result } = renderHook(() => useDeviceMonitoring(DEVICE_ID, RANGE));

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    const query = spy.calls[0].query;
    expect(query.from).toBe(RANGE.from);
    expect(query.to).toBe(RANGE.to);
    expect(query.bucket).toBe("hour");
  });
});
