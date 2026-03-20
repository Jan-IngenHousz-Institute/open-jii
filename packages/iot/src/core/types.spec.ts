import { describe, expect, it } from "vitest";

import { DEVICE_TRANSPORT_SUPPORT, getDeviceTransportSupport, isTransportSupported } from "./types";

describe("DEVICE_TRANSPORT_SUPPORT", () => {
  it("should declare multispeq as serial-only with Bluetooth Classic but no BLE", () => {
    const support = DEVICE_TRANSPORT_SUPPORT.multispeq;
    expect(support.supportedTransports).toEqual(["serial"]);
    expect(support.supportsBLE).toBe(false);
    expect(support.supportsBluetoothClassic).toBe(true);
  });

  it("should declare generic as bluetooth + serial with BLE", () => {
    const support = DEVICE_TRANSPORT_SUPPORT.generic;
    expect(support.supportedTransports).toEqual(["bluetooth", "serial"]);
    expect(support.supportsBLE).toBe(true);
    expect(support.supportsBluetoothClassic).toBe(false);
  });
});

describe("getDeviceTransportSupport", () => {
  it("should return multispeq support for multispeq", () => {
    expect(getDeviceTransportSupport("multispeq")).toBe(DEVICE_TRANSPORT_SUPPORT.multispeq);
  });

  it("should return generic support for generic", () => {
    expect(getDeviceTransportSupport("generic")).toBe(DEVICE_TRANSPORT_SUPPORT.generic);
  });
});

describe("isTransportSupported", () => {
  it("should return false for multispeq + bluetooth", () => {
    expect(isTransportSupported("multispeq", "bluetooth")).toBe(false);
  });

  it("should return true for multispeq + serial", () => {
    expect(isTransportSupported("multispeq", "serial")).toBe(true);
  });

  it("should return true for generic + bluetooth", () => {
    expect(isTransportSupported("generic", "bluetooth")).toBe(true);
  });

  it("should return true for generic + serial", () => {
    expect(isTransportSupported("generic", "serial")).toBe(true);
  });
});
