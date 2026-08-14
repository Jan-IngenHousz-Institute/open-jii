import { describe, expect, it } from "vitest";

import type { LifecycleEventRow } from "./device-connectivity";
import { deriveDeviceConnectivity } from "./device-connectivity";

const FROM = "2026-08-13T00:00:00.000Z";
const TO = "2026-08-13T12:00:00.000Z";
// Fixed "now" past the range end keeps every case fully elapsed and deterministic.
const NOW = new Date("2026-08-14T00:00:00.000Z").getTime();

function row(
  eventType: string | null,
  eventTimestamp: string | null,
  disconnectReason: string | null = null,
  sessionIdentifier: string | null = "s-1",
): LifecycleEventRow {
  return { eventType, eventTimestamp, disconnectReason, sessionIdentifier };
}

function derive(rows: LifecycleEventRow[], from = FROM, to = TO) {
  return deriveDeviceConnectivity(rows, from, to, NOW);
}

describe("deriveDeviceConnectivity", () => {
  describe("normalization", () => {
    it("drops rows with an unknown event type or missing timestamp", () => {
      const { events } = derive([
        row("connected", "2026-08-13T01:00:00.000Z"),
        row("rebooted", "2026-08-13T02:00:00.000Z"),
        row("disconnected", null),
        row(null, "2026-08-13T04:00:00.000Z"),
      ]);

      expect(events).toHaveLength(1);
      expect(events[0].eventType).toBe("connected");
    });
  });

  describe("session pairing", () => {
    it("pairs a connect/disconnect into a closed session with its reason", () => {
      const { sessions } = derive([
        row("connected", "2026-08-13T01:00:00.000Z"),
        row("disconnected", "2026-08-13T03:00:00.000Z", "MQTT_KEEP_ALIVE_TIMEOUT"),
      ]);

      expect(sessions).toEqual([
        {
          start: "2026-08-13T01:00:00.000Z",
          end: "2026-08-13T03:00:00.000Z",
          openStart: false,
          durationSeconds: 7200,
          disconnectReason: "MQTT_KEEP_ALIVE_TIMEOUT",
        },
      ]);
    });

    it("treats a leading disconnect as a session already running at range start", () => {
      const { sessions } = derive([
        row("disconnected", "2026-08-13T02:00:00.000Z", "CONNECTION_LOST"),
      ]);

      expect(sessions).toEqual([
        {
          start: FROM,
          end: "2026-08-13T02:00:00.000Z",
          openStart: true,
          durationSeconds: 7200,
          disconnectReason: "CONNECTION_LOST",
        },
      ]);
    });

    it("leaves a trailing connect open-ended, running to the range end", () => {
      const { sessions } = derive([row("connected", "2026-08-13T05:00:00.000Z")]);

      expect(sessions).toEqual([
        {
          start: "2026-08-13T05:00:00.000Z",
          end: null,
          openStart: false,
          durationSeconds: 7 * 3600,
          disconnectReason: null,
        },
      ]);
    });

    it("keeps the earliest start when connects repeat without a disconnect", () => {
      const { sessions } = derive([
        row("connected", "2026-08-13T01:00:00.000Z"),
        row("connected", "2026-08-13T02:00:00.000Z"),
        row("disconnected", "2026-08-13T04:00:00.000Z"),
      ]);

      expect(sessions).toHaveLength(1);
      expect(sessions[0].start).toBe("2026-08-13T01:00:00.000Z");
      expect(sessions[0].durationSeconds).toBe(3 * 3600);
    });

    it("ignores a stale disconnect from a previous MQTT session", () => {
      const { sessions } = derive([
        row("connected", "2026-08-13T01:00:00.000Z", null, "s-2"),
        row("disconnected", "2026-08-13T02:00:00.000Z", "DUPLICATE_CLIENTID", "s-1"),
        row("disconnected", "2026-08-13T03:00:00.000Z", "CONNECTION_LOST", "s-2"),
      ]);

      expect(sessions).toEqual([
        {
          start: "2026-08-13T01:00:00.000Z",
          end: "2026-08-13T03:00:00.000Z",
          openStart: false,
          durationSeconds: 7200,
          disconnectReason: "CONNECTION_LOST",
        },
      ]);
    });

    it("closes a merged session on the live identifier after repeated connects", () => {
      const { sessions } = derive([
        row("connected", "2026-08-13T01:00:00.000Z", null, "s-1"),
        row("connected", "2026-08-13T02:00:00.000Z", null, "s-2"),
        row("disconnected", "2026-08-13T02:30:00.000Z", "DUPLICATE_CLIENTID", "s-1"),
        row("disconnected", "2026-08-13T03:00:00.000Z", "CONNECTION_LOST", "s-2"),
      ]);

      expect(sessions).toHaveLength(1);
      expect(sessions[0].start).toBe("2026-08-13T01:00:00.000Z");
      expect(sessions[0].end).toBe("2026-08-13T03:00:00.000Z");
    });

    it("ignores an orphan disconnect after a closed session instead of opening a phantom one", () => {
      const { sessions } = derive([
        row("connected", "2026-08-13T01:00:00.000Z"),
        row("disconnected", "2026-08-13T02:00:00.000Z"),
        row("disconnected", "2026-08-13T03:00:00.000Z"),
      ]);

      expect(sessions).toHaveLength(1);
      expect(sessions[0].end).toBe("2026-08-13T02:00:00.000Z");
    });

    it("pairs leniently when either side lacks a session identifier", () => {
      const { sessions } = derive([
        row("connected", "2026-08-13T01:00:00.000Z", null, null),
        row("disconnected", "2026-08-13T02:00:00.000Z", "CONNECTION_LOST", "s-1"),
      ]);

      expect(sessions).toHaveLength(1);
      expect(sessions[0].end).toBe("2026-08-13T02:00:00.000Z");
    });
  });

  describe("uptime", () => {
    it("is null for a range without events", () => {
      const derivation = derive([]);

      expect(derivation.sessions).toEqual([]);
      expect(derivation.uptimePercent).toBeNull();
    });

    it("is null for an empty range", () => {
      const derivation = derive([row("connected", "2026-08-13T00:00:00.000Z")], FROM, FROM);

      expect(derivation.uptimePercent).toBeNull();
    });

    it("reflects the connected share of the elapsed range", () => {
      // 2h connected in a fully elapsed 12h range.
      const derivation = derive([
        row("connected", "2026-08-13T01:00:00.000Z"),
        row("disconnected", "2026-08-13T03:00:00.000Z"),
      ]);

      expect(derivation.uptimePercent).toBeCloseTo((2 / 12) * 100, 5);
    });

    it("never exceeds 100", () => {
      const derivation = derive([row("disconnected", "2026-08-13T12:00:00.000Z")]);

      expect(derivation.uptimePercent).toBeLessThanOrEqual(100);
    });
  });
});
