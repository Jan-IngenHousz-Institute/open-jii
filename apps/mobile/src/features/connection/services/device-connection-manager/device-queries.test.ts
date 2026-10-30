import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Device } from "~/shared/types/device";

import { getConnectedDevices } from "./device-queries";

const mocks = vi.hoisted(() => ({
  serial: [] as Device[],
  mock: [] as Device[],
  simulated: [] as Device[],
  bluetooth: vi.fn(),
}));
vi.mock("react-native-bluetooth-classic", () => ({
  default: { getConnectedDevices: mocks.bluetooth },
}));
vi.mock(
  "~/features/connection/services/device-connection-manager/android-serial-port-connection/open-serial-port-connection",
  () => ({ listSerialPortDevices: () => Promise.resolve([]) }),
);
vi.mock("./serial-port-connection", () => ({
  pruneSerialPorts: vi.fn(),
  getConnectedSerialPortDevices: () => mocks.serial,
}));
vi.mock("~/features/connection/services/multispeq/mock-device/mock-device-registry", () => ({
  getConnectedMockDevices: () => mocks.mock,
}));
vi.mock("~/features/connection/services/multispeq/mock-device/mock-devices-enabled", () => ({
  mockDevicesEnabled: true,
}));
vi.mock("~/features/connection/services/request-bluetooth-permissions", () => ({
  hasBluetoothPermission: () => Promise.resolve(false),
}));
vi.mock("~/features/connection/services/simulated-device", () => ({
  connectedSimulatedDevices: () => mocks.simulated,
}));

describe("connected device discovery", () => {
  beforeEach(() => {
    mocks.serial = [];
    mocks.mock = [];
    mocks.simulated = [{ id: "simulated:multispeq", name: "Simulated", type: "simulated-device" }];
    mocks.bluetooth.mockReset();
  });

  it("keeps connected USB devices together with the Demo simulator", async () => {
    mocks.serial = [{ id: "usb", name: "USB sensor", type: "usb" }];
    await expect(getConnectedDevices()).resolves.toEqual([...mocks.serial, ...mocks.simulated]);
    expect(mocks.bluetooth).not.toHaveBeenCalled();
  });

  it("keeps development mock devices together with the Demo simulator", async () => {
    mocks.mock = [{ id: "mock", name: "Mock sensor", type: "mock-device" }];
    await expect(getConnectedDevices()).resolves.toEqual([...mocks.mock, ...mocks.simulated]);
    expect(mocks.bluetooth).not.toHaveBeenCalled();
  });
});
