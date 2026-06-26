import { describe, expect, it } from "vitest";

import { discoveredEventToDevice } from "./device-utils";

describe("discoveredEventToDevice", () => {
  it("reads the device from a well-formed { device } event", () => {
    const device = discoveredEventToDevice({
      device: { address: "AA:BB:CC", name: "MultispeQ", rssi: -50 },
    });
    expect(device).toEqual({
      id: "AA:BB:CC",
      type: "bluetooth-classic",
      name: "MultispeQ",
      rssi: -50,
    });
  });

  it("accepts an event that is the device itself (lib shape varies)", () => {
    const device = discoveredEventToDevice({ address: "DD:EE:FF", name: "" });
    expect(device?.id).toBe("DD:EE:FF");
  });

  it("returns null for a device-less or malformed event instead of crashing", () => {
    expect(discoveredEventToDevice(undefined)).toBeNull();
    expect(discoveredEventToDevice(null)).toBeNull();
    expect(discoveredEventToDevice({})).toBeNull();
    expect(discoveredEventToDevice({ device: undefined })).toBeNull();
    expect(discoveredEventToDevice({ device: { address: "" } })).toBeNull();
  });
});
