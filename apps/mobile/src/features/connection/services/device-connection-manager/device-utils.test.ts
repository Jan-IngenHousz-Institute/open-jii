import type { BluetoothNativeDevice } from "react-native-bluetooth-classic";
import { describe, expect, it } from "vitest";

import { bluetoothDeviceToDevice, discoveredEventToDevice } from "./device-utils";

describe("bluetoothDeviceToDevice", () => {
  it("maps a device with a usable address", () => {
    const native = {
      address: "AA:BB:CC",
      name: "MultispeQ",
      rssi: -50,
    } as unknown as BluetoothNativeDevice;
    expect(bluetoothDeviceToDevice(native)).toEqual({
      id: "AA:BB:CC",
      type: "bluetooth-classic",
      name: "MultispeQ",
      rssi: -50,
    });
  });

  it("returns null for nullish or address-less entries instead of crashing", () => {
    expect(bluetoothDeviceToDevice(undefined)).toBeNull();
    expect(bluetoothDeviceToDevice(null)).toBeNull();
    // @ts-expect-error - exercising the runtime guard against malformed payloads
    expect(bluetoothDeviceToDevice({})).toBeNull();
    // @ts-expect-error - exercising the runtime guard against an empty address
    expect(bluetoothDeviceToDevice({ address: "" })).toBeNull();
  });
});

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
