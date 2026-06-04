import { beforeEach, describe, expect, it, vi } from "vitest";

import { getAllDevices, getConnectedDevice } from "./device-queries";

const startDiscovery = vi.fn();
const getConnectedDevices = vi.fn(() => Promise.resolve([]));

vi.mock("react-native-bluetooth-classic", () => ({
  default: {
    startDiscovery: () => startDiscovery(),
    getConnectedDevices: () => getConnectedDevices(),
  },
}));

const listSerialPortDevices = vi.fn();
vi.mock(
  "~/features/connection/services/multispeq-communication/android-serial-port-connection/open-serial-port-connection",
  () => ({
    listSerialPortDevices: () => listSerialPortDevices(),
  }),
);

const hasBluetoothPermission = vi.fn();
vi.mock("~/features/connection/services/request-bluetooth-permissions", () => ({
  hasBluetoothPermission: () => hasBluetoothPermission(),
}));

const getConnectedSerialPortDevice = vi.fn();
vi.mock("./serial-port-connection", () => ({
  getConnectedSerialPortDevice: () => getConnectedSerialPortDevice(),
}));

const serialDevice = (deviceId: number, vendorId: number, productId: number) => ({
  deviceId,
  vendorId,
  productId,
});

describe("getAllDevices", () => {
  beforeEach(() => {
    startDiscovery.mockReset().mockResolvedValue([]);
    listSerialPortDevices.mockReset().mockResolvedValue([]);
    hasBluetoothPermission.mockReset().mockResolvedValue(true);
    getConnectedSerialPortDevice.mockReset().mockReturnValue(undefined);
    getConnectedDevices.mockReset().mockResolvedValue([]);
  });

  it("lists serial devices even when Bluetooth permission is not granted", async () => {
    hasBluetoothPermission.mockResolvedValue(false);
    listSerialPortDevices.mockResolvedValue([serialDevice(1001, 5824, 1155)]);

    const result = await getAllDevices();

    // Bluetooth discovery must be skipped entirely so it can never starve or
    // block USB serial discovery once the BT permission is opt-in.
    expect(startDiscovery).not.toHaveBeenCalled();
    expect(result).toEqual([{ id: "1001", type: "usb", name: "MultispeQ" }]);
  });

  it("still surfaces serial devices when Bluetooth discovery rejects", async () => {
    hasBluetoothPermission.mockResolvedValue(true);
    startDiscovery.mockRejectedValue(new Error("discovery failed"));
    listSerialPortDevices.mockResolvedValue([serialDevice(1002, 1, 2)]);

    const result = await getAllDevices();

    expect(result).toEqual([{ id: "1002", type: "usb", name: "0001:0002" }]);
  });

  it("scans Bluetooth when permission is granted", async () => {
    hasBluetoothPermission.mockResolvedValue(true);
    listSerialPortDevices.mockResolvedValue([]);

    await getAllDevices();

    expect(startDiscovery).toHaveBeenCalledTimes(1);
  });
});

describe("getConnectedDevice", () => {
  beforeEach(() => {
    getConnectedSerialPortDevice.mockReset().mockReturnValue(undefined);
    getConnectedDevices.mockReset().mockResolvedValue([]);
  });

  it("reports the active serial device without touching Bluetooth", async () => {
    const serial = { id: "1001", type: "usb" as const, name: "MultispeQ" };
    getConnectedSerialPortDevice.mockReturnValue(serial);

    const result = await getConnectedDevice();

    expect(result).toBe(serial);
    expect(getConnectedDevices).not.toHaveBeenCalled();
  });

  it("returns null when nothing is connected", async () => {
    const result = await getConnectedDevice();
    expect(result).toBeNull();
  });
});
