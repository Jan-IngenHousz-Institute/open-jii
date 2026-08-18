import { createIotDeviceDetail } from "@/test/factories";
import { render, screen } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import type { DeviceMonitoring } from "@repo/api/domains/iot/iot.schema";

import type { MonitoringRange } from "./monitoring-range";
import { MonitoringTiles } from "./monitoring-tiles";

const RANGE: MonitoringRange = {
  from: "2026-08-13T00:00:00.000Z",
  to: "2026-08-13T12:00:00.000Z",
  bucket: "hour",
};

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
      workbookMix: [],
      macroMix: [],
    },
    firmwareHistory: [],
    recentMeasurements: [],
    ...overrides,
  };
}

const connectedDevice = () =>
  createIotDeviceDetail({
    connectivity: { connected: true, lastSeenAt: "2026-08-13T08:00:00.000Z" },
  });

describe("MonitoringTiles", () => {
  it("sums measurements for the window and states the rate they arrived at", () => {
    render(
      <MonitoringTiles
        device={connectedDevice()}
        activity={{ pipelineUnavailable: false, lastDataAt: new Date().toISOString() }}
        monitoring={monitoring()}
        range={RANGE}
      />,
    );

    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("iot.devices.monitoring.perHour")).toBeInTheDocument();
    expect(screen.queryByText("iot.devices.monitoring.connectedButSilent")).not.toBeInTheDocument();
  });

  it("flags a connected device whose data stopped flowing", () => {
    render(
      <MonitoringTiles
        device={connectedDevice()}
        activity={{ pipelineUnavailable: false, lastDataAt: "2026-08-13T00:00:00.000Z" }}
        monitoring={monitoring()}
        range={RANGE}
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
        activity={{ pipelineUnavailable: false, lastDataAt: null }}
        monitoring={monitoring()}
        range={RANGE}
      />,
    );

    expect(screen.queryByText("iot.devices.monitoring.connectedButSilent")).not.toBeInTheDocument();
    expect(screen.getByText("iot.devices.monitoring.noData")).toBeInTheDocument();
  });

  it("says unavailable, not silent, when the warehouse lookup failed", () => {
    render(
      <MonitoringTiles
        device={connectedDevice()}
        activity={{ pipelineUnavailable: true, lastDataAt: null }}
        monitoring={monitoring()}
        range={RANGE}
      />,
    );

    // A Databricks outage must not read as a device-health alarm.
    expect(screen.queryByText("iot.devices.monitoring.connectedButSilent")).not.toBeInTheDocument();
    expect(screen.queryByText("iot.devices.monitoring.noData")).not.toBeInTheDocument();
    expect(screen.getByText("iot.devices.monitoring.lastDataUnavailable")).toBeInTheDocument();
  });

  it("reports uptime with its session count, or says the window holds no evidence", () => {
    render(
      <MonitoringTiles
        device={connectedDevice()}
        activity={{ pipelineUnavailable: false, lastDataAt: null }}
        monitoring={monitoring({ uptimePercent: 99.5, sessions: [] })}
        range={RANGE}
      />,
    );

    expect(screen.getByText("99.5%")).toBeInTheDocument();
    expect(screen.getByText("iot.devices.monitoring.sessionCount")).toBeInTheDocument();
  });
});
