import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Device } from "~/shared/types/device";

import {
  getConnectedSerialPortDevice,
  setSerialPortConnection,
  verifyConnectedSerialPortDevice,
} from "./serial-port-connection";

const { mockList, mockOpen } = vi.hoisted(() => ({
  mockList: vi.fn(),
  mockOpen: vi.fn(),
}));

vi.mock(
  "~/features/connection/services/multispeq-communication/android-serial-port-connection/open-serial-port-connection",
  () => ({
    listSerialPortDevices: (...a: unknown[]) => mockList(...a),
    openSerialPortConnection: (...a: unknown[]) => mockOpen(...a),
  }),
);

const device = { id: "1002", type: "usb", name: "1a86:55d4" } as Device;

beforeEach(async () => {
  vi.clearAllMocks();
  mockOpen.mockResolvedValue({ emit: vi.fn() });
  await setSerialPortConnection(undefined); // reset module state
});

describe("verifyConnectedSerialPortDevice", () => {
  it("keeps the connection while the device is still enumerated", async () => {
    await setSerialPortConnection(device);
    mockList.mockResolvedValue([{ deviceId: 1002 }]);

    await verifyConnectedSerialPortDevice();

    expect(getConnectedSerialPortDevice()).toBeDefined();
  });

  it("drops the connection when the device is no longer enumerated (unplug)", async () => {
    await setSerialPortConnection(device);
    mockList.mockResolvedValue([{ deviceId: 9999 }]);

    await verifyConnectedSerialPortDevice();

    expect(getConnectedSerialPortDevice()).toBeUndefined();
  });

  it("keeps the connection if the device list can't be read", async () => {
    await setSerialPortConnection(device);
    mockList.mockRejectedValue(new Error("usb manager unavailable"));

    await verifyConnectedSerialPortDevice();

    expect(getConnectedSerialPortDevice()).toBeDefined();
  });

  it("is a no-op when nothing is connected", async () => {
    await verifyConnectedSerialPortDevice();
    expect(mockList).not.toHaveBeenCalled();
  });
});

describe("setSerialPortConnection reconnect", () => {
  it("tears down the previous connection before opening a new one", async () => {
    const firstEmit = vi.fn();
    mockOpen.mockResolvedValueOnce({ emit: firstEmit });

    await setSerialPortConnection(device); // open #1 (the leaked/stale one on replug)
    await setSerialPortConnection({ ...device, id: "1003" }); // reconnect

    expect(firstEmit).toHaveBeenCalledWith("destroy");
    expect(getConnectedSerialPortDevice()?.id).toBe("1003");
  });
});
