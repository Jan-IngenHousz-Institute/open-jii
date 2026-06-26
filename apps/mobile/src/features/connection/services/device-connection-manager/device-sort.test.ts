import { describe, expect, it } from "vitest";
import type { Device } from "~/shared/types/device";

import {
  isNamedDevice,
  looksLikeMac,
  mergeDevice,
  partitionDevices,
  sortDevices,
} from "./device-sort";

const ble = (name: string, id: string, rssi?: number): Device => ({
  type: "bluetooth-classic",
  name,
  id,
  rssi,
});

describe("looksLikeMac", () => {
  it("matches colon- and dash-separated addresses", () => {
    expect(looksLikeMac("AA:BB:CC:DD:EE:FF")).toBe(true);
    expect(looksLikeMac("aa-bb-cc-dd-ee-ff")).toBe(true);
  });

  it("rejects human and numeric names", () => {
    expect(looksLikeMac("MultispeQ")).toBe(false);
    expect(looksLikeMac("1520")).toBe(false);
  });
});

describe("isNamedDevice", () => {
  it("treats empty and MAC-looking names as unnamed", () => {
    expect(isNamedDevice(ble("", "AA:BB:CC:DD:EE:FF"))).toBe(false);
    expect(isNamedDevice(ble("AA:BB:CC:DD:EE:FF", "AA:BB:CC:DD:EE:FF"))).toBe(false);
  });

  it("treats numeric MultispeQ serials as named", () => {
    expect(isNamedDevice(ble("1520", "AA:BB:CC:DD:EE:01"))).toBe(true);
  });
});

describe("sortDevices", () => {
  it("orders MultispeQ first, then other named, then unnamed", () => {
    const devices = [
      ble("", "AA:00:00:00:00:01"),
      ble("Headphones", "AA:00:00:00:00:02"),
      ble("MultispeQ-X", "AA:00:00:00:00:03"),
    ];

    expect(sortDevices(devices).map((d) => d.id)).toEqual([
      "AA:00:00:00:00:03",
      "AA:00:00:00:00:02",
      "AA:00:00:00:00:01",
    ]);
  });

  it("breaks ties within a rank by stronger signal", () => {
    const devices = [ble("Speaker", "AA:01", -80), ble("Watch", "AA:02", -50)];
    expect(sortDevices(devices).map((d) => d.id)).toEqual(["AA:02", "AA:01"]);
  });

  it("orders a cabled USB/serial device ahead of bluetooth devices", () => {
    const usb: Device = { type: "usb", name: "1a86:55d4", id: "1002" };
    const devices = [ble("MultispeQ-X", "AA:00:00:00:00:03"), usb];
    expect(sortDevices(devices).map((d) => d.id)).toEqual(["1002", "AA:00:00:00:00:03"]);
  });
});

describe("mergeDevice", () => {
  it("appends a new device and refreshes an existing one by id+type", () => {
    const a = ble("MultispeQ", "AA:01", -70);
    const list = mergeDevice([], a);
    expect(list).toHaveLength(1);

    // Same id+type re-discovered with a stronger signal: refreshed in place.
    const refreshed = mergeDevice(list, ble("MultispeQ", "AA:01", -55));
    expect(refreshed).toHaveLength(1);
    expect(refreshed[0].rssi).toBe(-55);

    // Different id: appended.
    expect(mergeDevice(refreshed, ble("Watch", "AA:02"))).toHaveLength(2);
  });
});

describe("partitionDevices", () => {
  it("splits named (incl. MultispeQ) from unnamed/MAC-only", () => {
    const devices = [
      ble("MultispeQ", "AA:01"),
      ble("", "AA:02"),
      ble("Keyboard", "AA:03"),
      ble("BB:CC:DD:EE:FF:00", "BB:CC:DD:EE:FF:00"),
    ];

    const { named, unnamed } = partitionDevices(devices);
    expect(named.map((d) => d.id)).toEqual(["AA:01", "AA:03"]);
    expect(unnamed.map((d) => d.id)).toEqual(["AA:02", "BB:CC:DD:EE:FF:00"]);
  });
});
