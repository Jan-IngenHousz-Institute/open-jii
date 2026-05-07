import type { BluetoothDevice } from "react-native-bluetooth-classic";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getBluetoothClassicDevices } from "./get-bluetooth-classic-devices";

vi.mock("../../request-bluetooth-permissions", () => ({
  requestBluetoothPermission: vi.fn(() => Promise.resolve()),
}));

const cancelDiscovery = vi.fn(() => Promise.resolve(true));
const getBondedDevices = vi.fn(() => Promise.resolve([] as BluetoothDevice[]));
const getConnectedDevices = vi.fn(() => Promise.resolve([] as BluetoothDevice[]));
const startDiscovery = vi.fn(() => Promise.resolve([] as BluetoothDevice[]));

vi.mock("react-native-bluetooth-classic", () => ({
  default: {
    cancelDiscovery: () => cancelDiscovery(),
    getBondedDevices: () => getBondedDevices(),
    getConnectedDevices: () => getConnectedDevices(),
    startDiscovery: () => startDiscovery(),
  },
}));

const fakeDevice = (id: string, name: string) =>
  ({ id, address: id, name }) as unknown as BluetoothDevice;

describe("getBluetoothClassicDevices", () => {
  beforeEach(() => {
    cancelDiscovery.mockClear().mockResolvedValue(true);
    getBondedDevices.mockReset().mockResolvedValue([]);
    getConnectedDevices.mockReset().mockResolvedValue([]);
    startDiscovery.mockReset().mockResolvedValue([]);
  });

  it("returns devices regardless of name (numeric or otherwise)", async () => {
    // Regression for OJD-1487 / #1383: MultispeQ units relabelled to numeric
    // ids were silently dropped by the old `multi`/`photo` name filter.
    const numericMultispeq = fakeDevice("AA:01", "1520");
    const namedMultispeq = fakeDevice("AA:02", "MultispeQ-X");
    const otherDevice = fakeDevice("AA:03", "WH-1000XM4");

    getBondedDevices.mockResolvedValue([numericMultispeq, otherDevice]);
    startDiscovery.mockResolvedValue([namedMultispeq]);

    const result = await getBluetoothClassicDevices();

    expect(result.map((d) => d.id).sort()).toEqual(["AA:01", "AA:02", "AA:03"]);
  });

  it("dedupes devices that appear in multiple lists", async () => {
    const sameDevice = fakeDevice("BB:01", "1630");
    getBondedDevices.mockResolvedValue([sameDevice]);
    getConnectedDevices.mockResolvedValue([sameDevice]);
    startDiscovery.mockResolvedValue([sameDevice]);

    const result = await getBluetoothClassicDevices();

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("BB:01");
  });

  it("swallows cancelDiscovery errors and still scans", async () => {
    cancelDiscovery.mockRejectedValueOnce(new Error("nothing to cancel"));
    const device = fakeDevice("CC:01", "MultispeQ");
    getBondedDevices.mockResolvedValue([device]);

    const result = await getBluetoothClassicDevices();
    expect(result).toEqual([device]);
  });
});
