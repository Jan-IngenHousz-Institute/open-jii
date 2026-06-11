import { QueryClient, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import RNBluetoothClassic from "react-native-bluetooth-classic";
import { useDeviceConnectionStore } from "~/features/connection/hooks/use-device-connection-store";
import { closeAllSerialPorts } from "~/features/connection/services/device-connection-manager/serial-port-connection";
import { closeAllMockDevices } from "~/features/connection/services/multispeq-communication/mock-device/mock-device-registry";
import { useScannerCommandExecutorStore } from "~/features/connection/stores/use-scanner-command-executor-store";
import type { Device } from "~/shared/types/device";

import {
  connectToDevice,
  disconnectFromDevice,
  unpairDevice,
} from "../services/device-connection-manager/device-connection";
import {
  getConnectedDevice,
  getConnectedDevices,
  getAllDevices,
} from "../services/device-connection-manager/device-queries";

const CONNECTED_DEVICES_KEY = ["connected-devices"] as const;

/**
 * Bind once-per-app-lifetime listeners that keep the scanner executor in
 * sync with the connected-devices cache:
 *
 *   1. Native onDeviceDisconnected — fires immediately when the OS reports
 *      a disconnect (when it bothers to). Invalidates the query so the UI
 *      flips to the disconnect state ASAP.
 *   2. QueryCache subscriber on the connected-devices key — catches the
 *      polling-detected disconnect case (common on Android when the device
 *      is simply powered off or unplugged and no native event fires) AND
 *      the native event case after the invalidation refetches. The id-set
 *      diff clears exactly the disappeared devices' executors, so unplugging
 *      one of N hub devices fails only that device's in-flight scan.
 */
let listenersBound = false;
function initConnectedDeviceListeners(client: QueryClient) {
  if (listenersBound) return;
  listenersBound = true;

  RNBluetoothClassic.onDeviceDisconnected(() => {
    void client.invalidateQueries({ queryKey: CONNECTED_DEVICES_KEY });
  });

  let prevIds = new Set<string>(
    client.getQueryData<Device[]>(CONNECTED_DEVICES_KEY)?.map((d) => d.id) ?? [],
  );
  client.getQueryCache().subscribe((event) => {
    if (event.type !== "updated") return;
    if (event.query.queryKey[0] !== CONNECTED_DEVICES_KEY[0]) return;
    const next = event.query.state.data as Device[] | undefined;
    if (next === undefined) return;
    const nextIds = new Set(next.map((d) => d.id));
    prevIds.forEach((id) => {
      if (!nextIds.has(id)) {
        void useScannerCommandExecutorStore.getState().removeDevice(id);
      }
    });
    prevIds = nextIds;
  });
}

function useConnectedDevicesQuery<T>(select: (devices: Device[]) => T) {
  const client = useQueryClient();
  initConnectedDeviceListeners(client);

  return useQuery({
    queryKey: CONNECTED_DEVICES_KEY,
    queryFn: getConnectedDevices,
    networkMode: "always",
    // Poll so we catch disconnects even when the native
    // onDeviceDisconnected event doesn't fire (common on Android
    // when the device is simply powered off or unplugged). The
    // module-level QueryCache subscriber turns these polling-detected
    // transitions into per-device scanner-store cleanup.
    refetchInterval: 3000,
    select,
  });
}

export function useConnectedDevices() {
  return useConnectedDevicesQuery((devices) => devices);
}

export function useConnectedDevice() {
  // Primary device = first connected (see CONTEXT.md). Keeps every legacy
  // single-device consumer working against the plural query.
  return useConnectedDevicesQuery((devices) => devices[0] ?? null);
}

export function useConnectToDevice() {
  const client = useQueryClient();
  const [connectingDeviceId, setConnectingDeviceId] = useState<string>();
  const { setDevice, addDevice, removeDevice, destroy } = useScannerCommandExecutorStore();
  const { setLastConnectedDevice } = useDeviceConnectionStore();

  return {
    connectingDeviceId,
    async connectToDevice(device: Device) {
      setConnectingDeviceId(device.id);
      try {
        if (device.type === "bluetooth-classic") {
          // Transport exclusivity: Bluetooth replaces all USB/mock devices.
          await closeAllSerialPorts();
          closeAllMockDevices();
          await connectToDevice(device);
          await setDevice(device);
        } else {
          // USB/mock: drop a lingering Bluetooth device (exclusivity), then
          // ADD to the registry so hub devices accumulate.
          const connected = await getConnectedDevices();
          const bluetoothDevice = connected.find((d) => d.type === "bluetooth-classic");
          if (bluetoothDevice) {
            await disconnectFromDevice(bluetoothDevice);
            await removeDevice(bluetoothDevice.id);
          }
          await connectToDevice(device);
          await addDevice(device);
        }
        // Remember this device so the measurement flow can offer an inline
        // reconnect button if the connection is lost during a session.
        setLastConnectedDevice(device);
        await client.invalidateQueries({ queryKey: CONNECTED_DEVICES_KEY });
      } finally {
        setConnectingDeviceId(undefined);
      }
    },
    async disconnectFromDevice(device: Device) {
      await disconnectFromDevice(device);
      await removeDevice(device.id);
      await client.invalidateQueries({ queryKey: CONNECTED_DEVICES_KEY });
    },
    async unpairDevice(device: Device) {
      await unpairDevice(device);

      await client.invalidateQueries({ queryKey: CONNECTED_DEVICES_KEY });

      // Re-sync the executor store with whatever is still connected
      // (in case the unpaired device was the connected one)
      const connectedDevice = await getConnectedDevice();
      await destroy();
      if (connectedDevice) {
        await setDevice(connectedDevice);
      }
    },
  };
}

export function useAllDevices() {
  return useQuery({
    queryKey: ["all-devices"],
    queryFn: () => getAllDevices(),
    enabled: false,
    networkMode: "always",
  });
}
