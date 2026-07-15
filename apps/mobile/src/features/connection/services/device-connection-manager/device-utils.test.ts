import type { BluetoothNativeDevice } from "react-native-bluetooth-classic";
import { describe, expect, it } from "vitest";

import {
  bluetoothDeviceToDevice,
  discoveredEventToDevice,
  serialDeviceToDevice,
} from "./device-utils";

describe("serialDeviceToDevice", () => {
  it("names MultispeQs with the Android deviceId suffix (hub disambiguation)", () => {
    const device = serialDeviceToDevice({ deviceId: 1002, vendorId: 5824, productId: 1155 });
    expect(device).toEqual({ id: "1002", type: "usb", name: "MultispeQ #1002" });
  });

  it("names unknown sensors by their vendor:product pair", () => {
    const device = serialDeviceToDevice({ deviceId: 7, vendorId: 0x1a86, productId: 0x55d4 });
    expect(device).toEqual({ id: "7", type: "usb", name: "1a86:55d4 #7" });
  });
});

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
