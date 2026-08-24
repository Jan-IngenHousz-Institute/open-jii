import { createIotDevice } from "@/test/factories";
import { describe, expect, it } from "vitest";

import type { IotDeviceWithConnectivity } from "@repo/api/domains/iot/iot.schema";

import { fleetAttention, toFleetHealth } from "./fleet-health";

const NOW = new Date("2026-08-24T12:00:00.000Z").getTime();
const FRESH = "2026-08-24T11:30:00.000Z";
const STALE = "2026-08-20T00:00:00.000Z";

function device(overrides: Partial<IotDeviceWithConnectivity>): IotDeviceWithConnectivity {
  return createIotDevice({
    status: "active",
    connectivity: { connected: true, lastSeenAt: FRESH },
    ...overrides,
  });
}

describe("toFleetHealth", () => {
  it("joins last data onto each device and leaves unreported devices null", () => {
    const reported = device({ id: "11111111-1111-4111-8111-111111111111" });
    const silent = device({ id: "22222222-2222-4222-8222-222222222222" });

    const health = toFleetHealth(
      [reported, silent],
      [{ deviceId: reported.id, lastDataAt: FRESH }],
    );

    expect(health.map((member) => member.lastDataAt)).toEqual([FRESH, null]);
  });
});

describe("fleetAttention", () => {
  it("ranks a missing certificate above everything else", () => {
    const pending = device({ status: "pending", connectivity: null });
    const silent = device({ connectivity: { connected: true, lastSeenAt: FRESH } });

    const entries = fleetAttention(
      [silent, pending],
      [{ deviceId: silent.id, lastDataAt: STALE }],
      false,
      NOW,
    );

    expect(entries.map((entry) => entry.reason)).toEqual(["credentials", "silent"]);
    expect(entries[0].device.id).toBe(pending.id);
  });

  it("flags a credentialed device the broker has never seen", () => {
    const neverSeen = device({ connectivity: { connected: false, lastSeenAt: null } });

    const entries = fleetAttention([neverSeen], [], true, NOW);

    expect(entries).toEqual([{ device: neverSeen, reason: "neverConnected" }]);
  });

  it("does not call a device silent while the warehouse is unavailable", () => {
    const connected = device({});

    expect(fleetAttention([connected], [], true, NOW)).toEqual([]);
  });

  it("claims nothing from an unknown fleet index", () => {
    const unknown = device({ connectivity: null });

    expect(fleetAttention([unknown], [], false, NOW)).toEqual([]);
  });

  it("leaves phones alone: they set themselves up and connect on their own schedule", () => {
    const phone = device({
      deviceType: "mobile",
      status: "pending",
      connectivity: { connected: false, lastSeenAt: null },
    });

    expect(fleetAttention([phone], [], false, NOW)).toEqual([]);
  });

  it("flags an offline device only for setup gaps, never for being offline", () => {
    const offline = device({ connectivity: { connected: false, lastSeenAt: STALE } });

    expect(
      fleetAttention([offline], [{ deviceId: offline.id, lastDataAt: STALE }], false, NOW),
    ).toEqual([]);
  });
});
