import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StoreApi } from "zustand/vanilla";
import { createStore } from "zustand/vanilla";
import { useScannerCommandExecutorStore } from "~/features/connection/stores/use-scanner-command-executor-store";
import type { Device } from "~/shared/types/device";

import { connectionKeys } from "./connection-keys";
import { mountConnectionLifecycle } from "./connection-lifecycle";
import {
  connectToDevice,
  disconnectFromDevice,
} from "./device-connection-manager/device-connection";
import { getConnectedDevices } from "./device-connection-manager/device-queries";
import { mountSimulatedDevices } from "./simulated-device";

const mocks = vi.hoisted(() => ({
  flow: undefined as StoreApi<{ experimentId: string }> | undefined,
  hasBluetoothPermission: vi.fn<() => Promise<boolean>>(),
  getConnectedDevices: vi.fn<() => Promise<unknown[]>>(),
}));
vi.mock("~/features/measurement-flow/stores/use-measurement-flow-store", () => ({
  useMeasurementFlowStore: {
    getState: () => mocks.flow?.getState() ?? { experimentId: "" },
    subscribe: (listener: () => void) => mocks.flow?.subscribe(listener) ?? (() => undefined),
  },
}));
vi.mock("~/shared/api/orpc", () => ({
  orpc: {
    experiments: {
      listExperiments: { queryOptions: () => ({ queryKey: ["experiments", "related"] }) },
    },
  },
}));
vi.mock("react-native-bluetooth-classic", () => ({
  default: {
    onDeviceDisconnected: () => ({ remove: () => undefined }),
    getConnectedDevices: () => mocks.getConnectedDevices(),
  },
}));
vi.mock("~/features/connection/services/request-bluetooth-permissions", () => ({
  hasBluetoothPermission: () => mocks.hasBluetoothPermission(),
}));
vi.mock(
  "~/features/connection/services/device-connection-manager/android-serial-port-connection/open-serial-port-connection",
  () => ({ listSerialPortDevices: () => Promise.resolve([]) }),
);

const simulator: Device = {
  id: "simulated:multispeq",
  name: "Simulated MultispeQ",
  type: "simulated-device",
};
let client: QueryClient;
let unmount: () => void;

beforeEach(() => {
  mocks.flow = createStore(() => ({ experimentId: "demo" }));
  mocks.hasBluetoothPermission.mockResolvedValue(true);
  mocks.getConnectedDevices.mockReset();
  client = new QueryClient();
  client.setQueryData(
    ["experiments", "related"],
    [
      { id: "demo", organizationType: "demo" },
      { id: "ordinary", organizationType: "university" },
    ],
  );
  const unmountSimulated = mountSimulatedDevices(client);
  const unmountLifecycle = mountConnectionLifecycle({ queryClient: client });
  unmount = () => {
    unmountLifecycle();
    unmountSimulated();
  };
});
afterEach(async () => {
  unmount();
  await useScannerCommandExecutorStore.getState().destroy();
  client.clear();
});

describe("connection lifecycle with a simulated device", () => {
  it("disconnects a simulated device through the shared transport manager", async () => {
    await connectToDevice(simulator);
    await expect(getConnectedDevices()).resolves.toEqual([simulator]);
    mocks.hasBluetoothPermission.mockResolvedValue(false);
    await disconnectFromDevice(simulator);
    await expect(getConnectedDevices()).resolves.toEqual([]);
  });

  it("drops a cached simulator and its executor when navigation leaves the demo", async () => {
    await connectToDevice(simulator);
    await useScannerCommandExecutorStore.getState().addDevice(simulator);
    const executor = useScannerCommandExecutorStore
      .getState()
      .executors.get(simulator.id)?.executor;
    if (!executor) throw new Error("simulated executor was not created");
    const destroy = vi.spyOn(executor, "destroy");

    const observer = new QueryObserver(client, {
      queryKey: connectionKeys.connectedDevices,
      queryFn: getConnectedDevices,
      retry: false,
    });
    const unsubscribe = observer.subscribe(() => undefined);
    await vi.waitFor(() => expect(observer.getCurrentResult().data).toEqual([simulator]));
    await vi.waitFor(() =>
      expect(
        useScannerCommandExecutorStore.getState().executors.get(simulator.id)?.identity,
      ).toBeDefined(),
    );

    mocks.getConnectedDevices.mockRejectedValue(new Error("Bluetooth is disabled"));
    mocks.flow?.setState({ experimentId: "ordinary" });

    expect(client.getQueryData(connectionKeys.connectedDevices)).toEqual([]);
    expect(useScannerCommandExecutorStore.getState().executors.has(simulator.id)).toBe(false);
    expect(destroy).toHaveBeenCalled();

    await vi.waitFor(() => expect(observer.getCurrentResult().status).toBe("error"));
    expect(mocks.getConnectedDevices).toHaveBeenCalled();
    expect(observer.getCurrentResult().data).toEqual([]);
    unsubscribe();
  });

  it("skips the native Bluetooth query without permission", async () => {
    mocks.hasBluetoothPermission.mockResolvedValue(false);
    mocks.getConnectedDevices.mockRejectedValue(new Error("Permission denied"));
    await expect(getConnectedDevices()).resolves.toEqual([]);
    expect(mocks.getConnectedDevices).not.toHaveBeenCalled();
  });
});
