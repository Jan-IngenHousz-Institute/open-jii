import { QueryClient, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import RNBluetoothClassic from "react-native-bluetooth-classic";
import { useDeviceConnectionStore } from "~/features/connection/hooks/use-device-connection-store";
import { useScannerCommandExecutorStore } from "~/features/connection/stores/use-scanner-command-executor-store";
import type { Device } from "~/shared/types/device";

import {
  connectToDevice,
  disconnectFromDevice,
  unpairDevice,
} from "../services/device-connection-manager/device-connection";
import {
  getConnectedDevice,
  getAllDevices,
  getPairedDevices,
} from "../services/device-connection-manager/device-queries";

const CONNECTED_DEVICE_KEY = ["connected-device"] as const;

/**
 * Bind once-per-app-lifetime listeners that keep the scanner executor in
 * sync with the connected-device cache:
 *
 *   1. Native onDeviceDisconnected — fires immediately when the OS reports
 *      a disconnect (when it bothers to). Invalidates the query so the UI
 *      flips to the disconnect state ASAP.
 *   2. QueryCache subscriber on the connected-device key — catches the
 *      polling-detected disconnect case (common on Android when the device
 *      is simply powered off and no native event fires) AND the native
 *      event case after the invalidation refetches null. Either way, the
 *      scanner executor store gets cleared exactly when data transitions
 *      from non-null → null.
 *
 * Previously the QueryCache-subscriber path lived as a useEffect inside
 * useConnectedDevice, which ran once per consumer. The module-level
 * subscription is one listener for the whole app, and removes the only
 * useEffect that lived in this hook file.
 */
let listenersBound = false;
function initConnectedDeviceListeners(client: QueryClient) {
  if (listenersBound) return;
  listenersBound = true;

  RNBluetoothClassic.onDeviceDisconnected(() => {
    void client.invalidateQueries({ queryKey: CONNECTED_DEVICE_KEY });
  });

  let prev: Device | null | undefined = client.getQueryData(CONNECTED_DEVICE_KEY);
  client.getQueryCache().subscribe((event) => {
    if (event.type !== "updated") return;
    if (event.query.queryKey[0] !== CONNECTED_DEVICE_KEY[0]) return;
    const next = event.query.state.data as Device | null | undefined;
    if (prev && !next) {
      void useScannerCommandExecutorStore.getState().setDevice(undefined);
    }
    prev = next;
  });
}

export function useConnectedDevice() {
  const client = useQueryClient();
  initConnectedDeviceListeners(client);

  return useQuery({
    queryKey: CONNECTED_DEVICE_KEY,
    queryFn: getConnectedDevice,
    networkMode: "always",
    // Poll so we catch disconnects even when the native
    // onDeviceDisconnected event doesn't fire (common on Android
    // when the device is simply powered off). The module-level
    // QueryCache subscriber turns these polling-detected transitions
    // into the scanner-store cleanup.
    refetchInterval: 3000,
  });
}

export function useConnectToDevice() {
  const client = useQueryClient();
  const [connectingDeviceId, setConnectingDeviceId] = useState<string>();
  const { setDevice } = useScannerCommandExecutorStore();
  const { setLastConnectedDevice } = useDeviceConnectionStore();

  return {
    connectingDeviceId,
    async connectToDevice(device: Device) {
      setConnectingDeviceId(device.id);
      try {
        await connectToDevice(device);
        await setDevice(device);
        // Remember this device so the measurement flow can offer an inline
        // reconnect button if the connection is lost during a session.
        setLastConnectedDevice(device);
        await client.invalidateQueries({
          queryKey: ["connected-device"],
        });
        await client.invalidateQueries({
          queryKey: ["paired-devices"],
        });
      } finally {
        setConnectingDeviceId(undefined);
      }
    },
    async disconnectFromDevice(device: Device) {
      await disconnectFromDevice(device);
      await setDevice(undefined);
      await client.invalidateQueries({
        queryKey: ["connected-device"],
      });
    },
    async unpairDevice(device: Device) {
      await unpairDevice(device);

      await client.invalidateQueries({
        queryKey: ["connected-device"],
      });

      await client.invalidateQueries({
        queryKey: ["paired-devices"],
      });
      // Update scanner command executor store based on current connected device state
      // (in case the unpaired device was the connected one)
      const connectedDevice = await getConnectedDevice();
      await setDevice(connectedDevice ?? undefined);
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

export function usePairedDevices() {
  return useQuery({
    queryKey: ["paired-devices"],
    queryFn: () => getPairedDevices(),
    networkMode: "always",
  });
}
