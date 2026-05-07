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

const probeIsMultispeq = vi.fn();
vi.mock("./probe-is-multispeq", () => ({
  probeIsMultispeq: (device: BluetoothDevice) => probeIsMultispeq(device),
}));

const fakeDevice = (id: string, name: string) =>
  ({ id, address: id, name }) as unknown as BluetoothDevice;

describe("getBluetoothClassicDevices", () => {
  beforeEach(() => {
    cancelDiscovery.mockClear();
    getBondedDevices.mockReset().mockResolvedValue([]);
    getConnectedDevices.mockReset().mockResolvedValue([]);
    startDiscovery.mockReset().mockResolvedValue([]);
    probeIsMultispeq.mockReset();
  });

  it("returns only devices the probe identifies as MultispeQ, regardless of name", async () => {
    const numericMultispeq = fakeDevice("AA:01", "1520");
    const namedMultispeq = fakeDevice("AA:02", "MultispeQ-X");
    const headphones = fakeDevice("AA:03", "WH-1000XM4");

    getBondedDevices.mockResolvedValue([numericMultispeq, headphones]);
    startDiscovery.mockResolvedValue([namedMultispeq]);

    probeIsMultispeq.mockImplementation((d: BluetoothDevice) => Promise.resolve(d.id !== "AA:03"));

    const result = await getBluetoothClassicDevices();

    expect(result.map((d) => d.id).sort()).toEqual(["AA:01", "AA:02"]);
  });

  it("dedupes devices that appear in multiple lists (bonded + connected + visible)", async () => {
    const sameDevice = fakeDevice("BB:01", "1630");
    getBondedDevices.mockResolvedValue([sameDevice]);
    getConnectedDevices.mockResolvedValue([sameDevice]);
    startDiscovery.mockResolvedValue([sameDevice]);
    probeIsMultispeq.mockResolvedValue(true);

    const result = await getBluetoothClassicDevices();

    expect(result).toHaveLength(1);
    expect(probeIsMultispeq).toHaveBeenCalledTimes(1);
  });

  it("swallows cancelDiscovery errors and still scans", async () => {
    cancelDiscovery.mockRejectedValueOnce(new Error("nothing to cancel"));
    const device = fakeDevice("CC:01", "MultispeQ");
    getBondedDevices.mockResolvedValue([device]);
    probeIsMultispeq.mockResolvedValue(true);

    const result = await getBluetoothClassicDevices();
    expect(result).toEqual([device]);
  });

  it("returns an empty list when the probe rejects every candidate", async () => {
    getBondedDevices.mockResolvedValue([fakeDevice("DD:01", "Speaker")]);
    startDiscovery.mockResolvedValue([fakeDevice("DD:02", "Mouse")]);
    probeIsMultispeq.mockResolvedValue(false);

    const result = await getBluetoothClassicDevices();
    expect(result).toEqual([]);
  });
});
