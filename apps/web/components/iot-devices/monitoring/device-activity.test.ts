import { describe, expect, it } from "vitest";

import type { DeviceMeasurement, DeviceMonitoring } from "@repo/api/domains/iot/iot.schema";

import { buildDeviceActivity } from "./device-activity";

const FROM = "2026-08-13T00:00:00.000Z";
const TO = "2026-08-13T12:00:00.000Z";

function measurement(timestamp: string, deviceVersion: string | null): DeviceMeasurement {
  return {
    timestamp,
    experimentId: null,
    protocolId: null,
    workbookVersionId: null,
    deviceVersion,
    battery: null,
    latitude: null,
    longitude: null,
    sample: null,
  };
}

function monitoring(overrides: Partial<DeviceMonitoring> = {}): DeviceMonitoring {
  return {
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
      workbookMix: [],
    },
    recentMeasurements: [],
    ...overrides,
  };
}

describe("buildDeviceActivity", () => {
  it("merges broker events, firmware changes and registration, newest first", () => {
    const entries = buildDeviceActivity({
      monitoring: monitoring({
        events: [
          {
            eventType: "disconnected",
            eventTimestamp: "2026-08-13T05:00:00.000Z",
            disconnectReason: "CONNECTION_LOST",
            sessionIdentifier: "s-1",
          },
        ],
        // Newest first, as the warehouse returns them.
        recentMeasurements: [
          measurement("2026-08-13T09:00:00.000Z", "1.1.0"),
          measurement("2026-08-13T08:00:00.000Z", "1.0.0"),
        ],
      }),
      registeredAt: "2026-08-13T01:00:00.000Z",
      from: FROM,
      to: TO,
    });

    expect(entries.map((entry) => entry.kind)).toEqual([
      "firmwareChanged",
      "disconnected",
      "registered",
    ]);
    expect(entries[0].detail).toBe("1.0.0 → 1.1.0");
  });

  it("leaves out a registration that happened before the window", () => {
    const entries = buildDeviceActivity({
      monitoring: monitoring(),
      registeredAt: "2026-08-01T00:00:00.000Z",
      from: FROM,
      to: TO,
    });

    expect(entries).toEqual([]);
  });

  it("does not invent a firmware change when the version is steady or unreported", () => {
    const entries = buildDeviceActivity({
      monitoring: monitoring({
        recentMeasurements: [
          measurement("2026-08-13T09:00:00.000Z", "1.1.0"),
          measurement("2026-08-13T08:00:00.000Z", "1.1.0"),
          measurement("2026-08-13T07:00:00.000Z", null),
        ],
      }),
      from: FROM,
      to: TO,
    });

    expect(entries).toEqual([]);
  });
});
