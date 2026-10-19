// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Device } from "~/shared/types/device";

import { isConnectInFlight, useAllDevices, useConnectToDevice } from "./use-device-connection";

const mocks = vi.hoisted(() => ({
  transportConnect: vi.fn(),
  addDevice: vi.fn(),
  setLastConnectedDevice: vi.fn(),
  serialDevices: [] as { deviceId: number; vendorId: number; productId: number }[],
  serialListError: undefined as Error | undefined,
  hasBluetoothPermission: vi.fn<() => Promise<boolean>>(),
  cancelDiscovery: vi.fn<() => Promise<boolean>>(),
  getBondedDevices: vi.fn<() => Promise<{ address: string; name: string }[]>>(),
  getConnectedDevices: vi.fn<() => Promise<{ address: string; name: string }[]>>(),
  startDiscovery: vi.fn<() => Promise<unknown[]>>(),
}));

vi.mock("react-native-bluetooth-classic", () => ({
  default: {
    onDeviceDiscovered: () => ({ remove: () => undefined }),
    cancelDiscovery: () => mocks.cancelDiscovery(),
    getBondedDevices: () => mocks.getBondedDevices(),
    getConnectedDevices: () => mocks.getConnectedDevices(),
    startDiscovery: () => mocks.startDiscovery(),
  },
}));
vi.mock("~/features/connection/services/request-bluetooth-permissions", () => ({
  hasBluetoothPermission: () => mocks.hasBluetoothPermission(),
}));
vi.mock(
  "~/features/connection/services/device-connection-manager/android-serial-port-connection/open-serial-port-connection",
  () => ({
    listSerialPortDevices: () =>
      mocks.serialListError
        ? Promise.reject(mocks.serialListError)
        : Promise.resolve(mocks.serialDevices),
  }),
);
vi.mock("~/features/connection/services/device-connection-manager/serial-port-connection", () => ({
  closeAllSerialPorts: () => Promise.resolve(),
}));
vi.mock("~/features/connection/services/multispeq/mock-device/list-mock-devices", () => ({
  listMockDevices: () => Promise.resolve([]),
}));
vi.mock("~/features/connection/services/multispeq/mock-device/mock-device-registry", () => ({
  closeAllMockDevices: () => undefined,
}));
vi.mock("~/features/connection/services/multispeq/mock-device/mock-devices-enabled", () => ({
  mockDevicesEnabled: false,
}));
vi.mock("~/features/connection/services/device-connection-manager/device-queries", () => ({
  getConnectedDevices: () => Promise.resolve([]),
}));
vi.mock("~/features/connection/services/device-connection-manager/device-connection", () => ({
  connectToDevice: (device: Device) => mocks.transportConnect(device),
  disconnectFromDevice: () => Promise.resolve(),
  unpairDevice: () => Promise.resolve(),
}));
vi.mock("~/features/connection/stores/use-scanner-command-executor-store", () => {
  const state = {
    executors: new Map(),
    setDevice: () => Promise.resolve(),
    addDevice: (device: Device) => mocks.addDevice(device),
    removeDevice: () => Promise.resolve(),
  };
  const hook = () => state;
  hook.getState = () => state;
  return { useScannerCommandExecutorStore: hook };
});
vi.mock("~/features/connection/hooks/use-device-connection-store", () => ({
  useDeviceConnectionStore: () => ({
    lastConnectedDevice: undefined,
    setLastConnectedDevice: (device: Device) => mocks.setLastConnectedDevice(device),
  }),
}));

function renderConnectHook() {
  const client = new QueryClient();
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(() => useConnectToDevice(), { wrapper });
}

describe("useConnectToDevice", () => {
  beforeEach(() => {
    mocks.transportConnect.mockReset();
    mocks.addDevice.mockReset().mockResolvedValue(undefined);
    mocks.setLastConnectedDevice.mockReset();
    mocks.serialDevices = [];
    mocks.serialListError = undefined;
  });

  it("joins a connect already in flight for the same device from another instance", async () => {
    const device: Device = { id: "2002", type: "usb", name: "1a86:55d4 #2002" };
    let finish: () => void = () => undefined;
    mocks.transportConnect.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    // Two hook instances, like the device sheet and useAutoReconnect.
    const sheet = renderConnectHook();
    const auto = renderConnectHook();

    let first: Promise<void> = Promise.resolve();
    let second: Promise<void> = Promise.resolve();
    act(() => {
      first = sheet.result.current.connectToDevice(device);
    });
    await waitFor(() => expect(mocks.transportConnect).toHaveBeenCalledTimes(1));
    expect(isConnectInFlight()).toBe(true);
    act(() => {
      second = auto.result.current.connectToDevice(device);
    });

    await act(async () => {
      finish();
      await Promise.all([first, second]);
    });

    expect(mocks.transportConnect).toHaveBeenCalledTimes(1);
    expect(mocks.addDevice).toHaveBeenCalledTimes(1);
    expect(isConnectInFlight()).toBe(false);
  });

  it("names a USB device after the device now at its id, not the remembered record", async () => {
    // The phone remembers a MultispeQ under 2002; an Ambit now holds that id.
    mocks.serialDevices = [{ deviceId: 2002, vendorId: 0x1a86, productId: 0x55d4 }];
    mocks.transportConnect.mockResolvedValue(undefined);
    const remembered: Device = { id: "2002", type: "usb", name: "MultispeQ #2002" };
    const { result } = renderConnectHook();

    await act(async () => {
      await result.current.connectToDevice(remembered);
    });

    const live: Device = { id: "2002", type: "usb", name: "1a86:55d4 #2002" };
    expect(mocks.transportConnect).toHaveBeenCalledWith(live);
    expect(mocks.addDevice).toHaveBeenCalledWith(live);
    expect(mocks.setLastConnectedDevice).toHaveBeenCalledWith(live);
  });

  it("keeps the given record when the id is not on the USB bus", async () => {
    mocks.transportConnect.mockResolvedValue(undefined);
    const device: Device = { id: "2003", type: "usb", name: "1a86:55d4 #2003" };
    const { result } = renderConnectHook();

    await act(async () => {
      await result.current.connectToDevice(device);
    });

    expect(mocks.transportConnect).toHaveBeenCalledWith(device);
  });

  it("keeps the given record when the USB list cannot be read", async () => {
    mocks.serialListError = new Error("USB service unavailable");
    mocks.transportConnect.mockResolvedValue(undefined);
    const device: Device = { id: "2002", type: "usb", name: "1a86:55d4 #2002" };
    const { result } = renderConnectHook();

    await act(async () => {
      await result.current.connectToDevice(device);
    });

    expect(mocks.transportConnect).toHaveBeenCalledWith(device);
    expect(mocks.addDevice).toHaveBeenCalledWith(device);
  });
});

describe("useAllDevices", () => {
  const bonded = { address: "00:11:22:33:44:55", name: "MultispeQ" };

  beforeEach(() => {
    mocks.serialDevices = [{ deviceId: 2002, vendorId: 0x1a86, productId: 0x55d4 }];
    mocks.serialListError = undefined;
    mocks.hasBluetoothPermission.mockReset().mockResolvedValue(true);
    mocks.cancelDiscovery.mockReset().mockResolvedValue(true);
    mocks.getBondedDevices.mockReset().mockResolvedValue([bonded]);
    mocks.getConnectedDevices.mockReset().mockResolvedValue([]);
    mocks.startDiscovery.mockReset().mockResolvedValue([]);
  });

  async function refetch() {
    const hook = renderHook(() => useAllDevices());
    await act(async () => {
      await hook.result.current.refetch();
    });
    return hook;
  }

  it("never touches Bluetooth without the scan permission, but still lists USB devices", async () => {
    mocks.hasBluetoothPermission.mockResolvedValue(false);

    const { result } = await refetch();

    expect(mocks.startDiscovery).not.toHaveBeenCalled();
    expect(mocks.cancelDiscovery).not.toHaveBeenCalled();
    expect(mocks.getBondedDevices).not.toHaveBeenCalled();
    expect(mocks.getConnectedDevices).not.toHaveBeenCalled();
    expect(result.current.data.map((d) => d.id)).toEqual(["2002"]);
    expect(result.current.isFetching).toBe(false);
  });

  it("treats a failed permission check as no permission", async () => {
    mocks.hasBluetoothPermission.mockRejectedValue(new Error("PermissionsAndroid unavailable"));

    await refetch();

    expect(mocks.startDiscovery).not.toHaveBeenCalled();
  });

  it("seeds bonded devices and scans when the permission is granted", async () => {
    const { result } = await refetch();

    expect(mocks.startDiscovery).toHaveBeenCalledTimes(1);
    expect(result.current.data.map((d) => d.id)).toEqual(
      expect.arrayContaining(["2002", bonded.address]),
    );
  });

  it("stops fetching when the scan is rejected", async () => {
    mocks.startDiscovery.mockRejectedValue(new Error("DISCOVERY_FAILED"));

    const { result } = await refetch();

    expect(result.current.isFetching).toBe(false);
  });
});
