import { createDeviceGroupMemberHealth } from "@/test/factories";
import { describe, expect, it } from "vitest";

import type { IotDeviceGroupLifecycleEvent } from "@repo/api/domains/iot/device-group/iot-device-group.schema";

import { buildGroupActivity, memberLabels } from "./group-activity";

const DEVICE_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const EARLIER = "2026-08-18T09:00:00.000Z";
const LATER = "2026-08-18T11:00:00.000Z";

const UNKNOWN = "iot.groups.monitoring.unknownMember";
const LABELS = new Map([[DEVICE_ID, "Gateway One"]]);

function lifecycleEvent(
  overrides: Partial<IotDeviceGroupLifecycleEvent>,
): IotDeviceGroupLifecycleEvent {
  return {
    deviceId: DEVICE_ID,
    eventType: "connected",
    eventTimestamp: EARLIER,
    disconnectReason: null,
    ...overrides,
  };
}

describe("buildGroupActivity", () => {
  it("maps connect and disconnect events newest first", () => {
    const entries = buildGroupActivity(
      [
        lifecycleEvent({ eventType: "connected", eventTimestamp: EARLIER }),
        lifecycleEvent({ eventType: "disconnected", eventTimestamp: LATER }),
      ],
      LABELS,
      UNKNOWN,
    );

    expect(entries.map((entry) => entry.kind)).toEqual(["disconnected", "connected"]);
    expect(entries.map((entry) => entry.timestamp)).toEqual([LATER, EARLIER]);
  });

  it("labels the device, appending the disconnect reason when there is one", () => {
    const entries = buildGroupActivity(
      [
        lifecycleEvent({ eventType: "connected" }),
        lifecycleEvent({
          eventType: "disconnected",
          eventTimestamp: LATER,
          disconnectReason: "CONNECTION_LOST",
        }),
      ],
      LABELS,
      UNKNOWN,
    );

    expect(entries.map((entry) => entry.detail)).toEqual([
      "Gateway One · CONNECTION_LOST",
      "Gateway One",
    ]);
  });

  it("drops events without a timestamp or with an unknown type", () => {
    const entries = buildGroupActivity(
      [
        lifecycleEvent({ eventTimestamp: null }),
        lifecycleEvent({ eventType: "provisioned" }),
        lifecycleEvent({ eventType: null }),
      ],
      LABELS,
      UNKNOWN,
    );

    expect(entries).toEqual([]);
  });

  it("falls back to the unknown-device label", () => {
    const entries = buildGroupActivity(
      [
        lifecycleEvent({ deviceId: null }),
        lifecycleEvent({ deviceId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" }),
      ],
      LABELS,
      UNKNOWN,
    );

    expect(entries.map((entry) => entry.detail)).toEqual([UNKNOWN, UNKNOWN]);
  });
});

describe("memberLabels", () => {
  it("keys each member's resolved label by device id", () => {
    const named = createDeviceGroupMemberHealth({ name: "Gateway One" });
    const unnamed = createDeviceGroupMemberHealth({ name: null, serialNumber: "AA:11" });

    const labels = memberLabels([named, unnamed], (member) => member.name ?? member.serialNumber);

    expect(labels.get(named.deviceId)).toBe("Gateway One");
    expect(labels.get(unnamed.deviceId)).toBe("AA:11");
  });
});
