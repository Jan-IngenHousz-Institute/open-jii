import { describe, expect, it } from "vitest";

import type { DeviceMonitoring } from "@repo/api/domains/iot/iot.schema";

import { buildAvailabilitySlices, deriveOutages } from "./availability-strip";

const FROM = "2026-08-13T00:00:00.000Z";
const TO = "2026-08-13T12:00:00.000Z";
const NOW = new Date("2026-08-14T00:00:00.000Z").getTime();

function monitoring(overrides: Partial<DeviceMonitoring> = {}): DeviceMonitoring {
  return {
    bucket: "hour",
    events: [
      {
        eventType: "connected",
        eventTimestamp: "2026-08-13T06:00:00.000Z",
        disconnectReason: null,
        sessionIdentifier: "s-1",
      },
    ],
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

function session(start: string, end: string | null, reason: string | null = null) {
  return { start, end, openStart: false, durationSeconds: 0, disconnectReason: reason };
}

describe("deriveOutages", () => {
  it("opens with an outage when the window starts before the first session", () => {
    const outages = deriveOutages(
      monitoring({ sessions: [session("2026-08-13T06:00:00.000Z", null)] }),
      FROM,
      TO,
      NOW,
    );

    expect(outages).toHaveLength(1);
    expect(outages[0].start).toBe(FROM);
    expect(outages[0].end).toBe("2026-08-13T06:00:00.000Z");
    // The cause lies before the window, so none is claimed.
    expect(outages[0].reason).toBeNull();
    expect(outages[0].durationSeconds).toBe(6 * 3600);
  });

  it("reports the whole window as down when there is evidence but no session", () => {
    const outages = deriveOutages(monitoring(), FROM, TO, NOW);

    expect(outages).toHaveLength(1);
    expect(outages[0].start).toBe(FROM);
    expect(outages[0].end).toBeNull();
    expect(outages[0].durationSeconds).toBe(12 * 3600);
  });

  it("stays silent when the window holds no lifecycle evidence at all", () => {
    // Unknown is not the same as down; the strip already says so.
    expect(deriveOutages(monitoring({ events: [] }), FROM, TO, NOW)).toEqual([]);
  });

  it("lists the gap between two sessions with the reason the first ended", () => {
    const outages = deriveOutages(
      monitoring({
        sessions: [
          session(FROM, "2026-08-13T03:00:00.000Z", "CONNECTION_LOST"),
          session("2026-08-13T05:00:00.000Z", null),
        ],
      }),
      FROM,
      TO,
      NOW,
    );

    expect(outages).toHaveLength(1);
    expect(outages[0].reason).toBe("CONNECTION_LOST");
    expect(outages[0].durationSeconds).toBe(2 * 3600);
  });
});

describe("buildAvailabilitySlices", () => {
  const axis = ["2026-08-13T00:00:00.000Z", "2026-08-13T06:00:00.000Z"];

  it("grades a fully covered slice as up and an untouched one as down", () => {
    const slices = buildAvailabilitySlices(
      monitoring({ sessions: [session(FROM, "2026-08-13T06:00:00.000Z")] }),
      axis,
      TO,
      NOW,
    );

    expect(slices.map((slice) => slice.state)).toEqual(["up", "down"]);
    expect(slices[0].onlineRatio).toBe(1);
  });

  it("grades a slice the device was online for part of as partial", () => {
    const slices = buildAvailabilitySlices(
      monitoring({ sessions: [session(FROM, "2026-08-13T03:00:00.000Z")] }),
      axis,
      TO,
      NOW,
    );

    expect(slices[0].state).toBe("partial");
    expect(slices[0].onlineRatio).toBeCloseTo(0.5, 5);
  });

  it("grades every slice unknown when the window holds no evidence", () => {
    const slices = buildAvailabilitySlices(monitoring({ events: [] }), axis, TO, NOW);

    // No events means the state was never observed, which is not the same as
    // the device being down.
    expect(slices.every((slice) => slice.state === "unknown")).toBe(true);
  });
});
