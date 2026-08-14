import { render, screen } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import type { DeviceMonitoring } from "@repo/api/domains/iot/iot.schema";

import { SessionStrip } from "./session-strip";

const FROM = "2026-08-13T00:00:00.000Z";
const TO = "2026-08-13T12:00:00.000Z";

function monitoring(overrides: Partial<DeviceMonitoring> = {}): DeviceMonitoring {
  return {
    bucket: "hour",
    events: [],
    sessions: [
      {
        start: "2026-08-13T01:00:00.000Z",
        end: "2026-08-13T03:00:00.000Z",
        openStart: false,
        durationSeconds: 7200,
        disconnectReason: "MQTT_KEEP_ALIVE_TIMEOUT",
      },
      {
        start: "2026-08-13T05:00:00.000Z",
        end: "2026-08-13T06:00:00.000Z",
        openStart: false,
        durationSeconds: 3600,
        disconnectReason: "MQTT_KEEP_ALIVE_TIMEOUT",
      },
      {
        start: "2026-08-13T08:00:00.000Z",
        end: "2026-08-13T09:00:00.000Z",
        openStart: false,
        durationSeconds: 3600,
        disconnectReason: "CONNECTION_LOST",
      },
    ],
    uptimePercent: 33.3,
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
    ...overrides,
  };
}

describe("SessionStrip", () => {
  it("renders one focusable band segment per session", () => {
    render(<SessionStrip monitoring={monitoring()} from={FROM} to={TO} />);

    const segments = screen.getAllByRole("img");
    expect(segments).toHaveLength(3);
    expect(segments[0]).toHaveAttribute("tabindex", "0");
  });

  it("summarizes the most frequent disconnect reasons", () => {
    render(<SessionStrip monitoring={monitoring()} from={FROM} to={TO} />);

    expect(screen.getByText(/MQTT_KEEP_ALIVE_TIMEOUT ×2/)).toBeInTheDocument();
    expect(screen.getByText(/CONNECTION_LOST ×1/)).toBeInTheDocument();
  });

  it("discloses truncation so partial coverage is never mistaken for the whole range", () => {
    render(<SessionStrip monitoring={monitoring({ truncated: true })} from={FROM} to={TO} />);

    expect(screen.getByText("iot.devices.monitoring.truncated")).toBeInTheDocument();
  });
});
