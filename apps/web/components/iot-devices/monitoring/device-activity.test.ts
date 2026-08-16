import { describe, expect, it } from "vitest";

import type { DeviceFirmwareVersion, DeviceMonitoring } from "@repo/api/domains/iot/iot.schema";

import { buildDeviceActivity } from "./device-activity";

const FROM = "2026-08-13T00:00:00.000Z";
const TO = "2026-08-13T12:00:00.000Z";

function firmware(version: string, firstSeen: string, lastSeen: string): DeviceFirmwareVersion {
  return { version, firstSeen, lastSeen, count: 10 };
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
      macroMix: [],
    },
    firmwareHistory: [],
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
        firmwareHistory: [
          firmware("1.0.0", "2026-08-13T02:00:00.000Z", "2026-08-13T08:00:00.000Z"),
          firmware("1.1.0", "2026-08-13T09:00:00.000Z", "2026-08-13T11:00:00.000Z"),
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
    expect(entries[0].timestamp).toBe("2026-08-13T09:00:00.000Z");
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

  it("treats the version the window opened on as state, not a change", () => {
    const entries = buildDeviceActivity({
      monitoring: monitoring({
        firmwareHistory: [
          firmware("1.1.0", "2026-08-13T01:00:00.000Z", "2026-08-13T11:00:00.000Z"),
        ],
      }),
      from: FROM,
      to: TO,
    });

    expect(entries).toEqual([]);
  });

  it("records every step of a multi-version window", () => {
    const entries = buildDeviceActivity({
      monitoring: monitoring({
        firmwareHistory: [
          firmware("1.0.0", "2026-08-13T01:00:00.000Z", "2026-08-13T03:00:00.000Z"),
          firmware("1.1.0", "2026-08-13T04:00:00.000Z", "2026-08-13T06:00:00.000Z"),
          firmware("2.0.0", "2026-08-13T07:00:00.000Z", "2026-08-13T11:00:00.000Z"),
        ],
      }),
      from: FROM,
      to: TO,
    });

    expect(entries.map((entry) => entry.detail)).toEqual(["1.1.0 → 2.0.0", "1.0.0 → 1.1.0"]);
  });
});
