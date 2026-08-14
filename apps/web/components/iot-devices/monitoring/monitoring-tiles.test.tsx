import { createIotDeviceDetail } from "@/test/factories";
import { render, screen } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import type { DeviceMonitoring } from "@repo/api/domains/iot/iot.schema";

import { MonitoringTiles } from "./monitoring-tiles";

function monitoring(overrides: Partial<DeviceMonitoring> = {}): DeviceMonitoring {
  return {
    bucket: "hour",
    events: [],
    sessions: [],
    uptimePercent: null,
    truncated: false,
    throughput: [
      { bucketStart: "2026-08-13T01:00:00.000Z", experimentId: null, count: 7 },
      { bucketStart: "2026-08-13T02:00:00.000Z", experimentId: null, count: 5 },
    ],
    battery: [
      { bucketStart: "2026-08-13T01:00:00.000Z", averageBattery: 92.4 },
      { bucketStart: "2026-08-13T02:00:00.000Z", averageBattery: null },
    ],
    payload: {
      totalMeasurements: 12,
      withGps: 0,
      withBattery: 12,
      workbookRuns: 0,
      firmwareMix: [],
      protocolMix: [],
    },
    ...overrides,
  };
}

const connectedDevice = () =>
  createIotDeviceDetail({
    connectivity: { connected: true, lastSeenAt: "2026-08-13T08:00:00.000Z" },
  });

describe("MonitoringTiles", () => {
  it("sums measurements and shows the latest known battery", () => {
    render(
      <MonitoringTiles
        device={connectedDevice()}
        activity={{ lastDataAt: new Date().toISOString() }}
        monitoring={monitoring()}
      />,
    );

    expect(screen.getByText("12")).toBeInTheDocument();
    // The trailing null bucket must not blank the battery tile.
    expect(screen.getByText("92%")).toBeInTheDocument();
    expect(screen.queryByText("iot.devices.monitoring.connectedButSilent")).not.toBeInTheDocument();
  });

  it("flags a connected device whose data stopped flowing", () => {
    render(
      <MonitoringTiles
        device={connectedDevice()}
        activity={{ lastDataAt: "2026-08-13T00:00:00.000Z" }}
        monitoring={monitoring()}
      />,
    );

    expect(screen.getByText("iot.devices.monitoring.connectedButSilent")).toBeInTheDocument();
  });

  it("does not flag a disconnected device as silent", () => {
    render(
      <MonitoringTiles
        device={createIotDeviceDetail({
          connectivity: { connected: false, lastSeenAt: "2026-08-13T00:00:00.000Z" },
        })}
        activity={{ lastDataAt: null }}
        monitoring={monitoring()}
      />,
    );

    expect(screen.queryByText("iot.devices.monitoring.connectedButSilent")).not.toBeInTheDocument();
    expect(screen.getByText("iot.devices.monitoring.noData")).toBeInTheDocument();
  });

  it("shows the no-battery state for families that never report it", () => {
    render(
      <MonitoringTiles
        device={connectedDevice()}
        activity={{ lastDataAt: null }}
        monitoring={monitoring({ battery: [] })}
      />,
    );

    expect(screen.getByText("iot.devices.monitoring.noBattery")).toBeInTheDocument();
  });
});
