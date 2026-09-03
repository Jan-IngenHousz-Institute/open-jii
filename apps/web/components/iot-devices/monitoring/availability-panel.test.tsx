import { render, screen } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import type { DeviceMonitoring } from "@repo/api/domains/iot/iot.schema";

import { AvailabilityPanel } from "./availability-panel";

const FROM = "2026-08-13T00:00:00.000Z";
const TO = "2026-08-13T06:00:00.000Z";

function monitoring(): DeviceMonitoring {
  return {
    bucket: "hour",
    events: [
      {
        eventType: "connected",
        eventTimestamp: "2026-08-13T01:00:00.000Z",
        disconnectReason: null,
        sessionIdentifier: "s-1",
      },
      {
        eventType: "disconnected",
        eventTimestamp: "2026-08-13T02:00:00.000Z",
        disconnectReason: "CONNECTION_LOST",
        sessionIdentifier: "s-1",
      },
    ],
    sessions: [
      {
        start: "2026-08-13T01:00:00.000Z",
        end: "2026-08-13T02:00:00.000Z",
        openStart: false,
        durationSeconds: 3600,
        disconnectReason: "CONNECTION_LOST",
      },
    ],
    uptimePercent: 42.5,
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
      workbookMix: [],
      macroMix: [],
    },
    firmwareHistory: [],
    recentMeasurements: [],
  };
}

describe("AvailabilityPanel", () => {
  it("shows the uptime verdict and outages for instrument devices", () => {
    render(<AvailabilityPanel monitoring={monitoring()} from={FROM} to={TO} showVerdict />);

    expect(screen.getByText("42.5%")).toBeInTheDocument();
    expect(screen.getByText("iot.devices.monitoring.outages")).toBeInTheDocument();
    expect(screen.getByText("iot.devices.monitoring.outageList")).toBeInTheDocument();
  });

  it("keeps the connection history but drops the verdict for phones", () => {
    render(<AvailabilityPanel monitoring={monitoring()} from={FROM} to={TO} showVerdict={false} />);

    expect(screen.queryByText("42.5%")).not.toBeInTheDocument();
    expect(screen.queryByText("iot.devices.monitoring.outages")).not.toBeInTheDocument();
    expect(screen.queryByText("iot.devices.monitoring.outageList")).not.toBeInTheDocument();
    // The neutral pieces stay: window, sessions, the strip's legend.
    expect(screen.getByText("iot.devices.monitoring.sessions")).toBeInTheDocument();
    expect(screen.getByText("iot.devices.monitoring.legendUp")).toBeInTheDocument();
  });
});
