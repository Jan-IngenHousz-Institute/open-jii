import { QueryClient, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import RNBluetoothClassic from "react-native-bluetooth-classic";
import { useDeviceConnectionStore } from "~/hooks/use-device-connection-store";
import { useScannerCommandExecutorStore } from "~/stores/use-scanner-command-executor-store";
import type { Device } from "~/types/device";

import { connectToDevice, disconnectFromDevice, unpairDevice } from "./device-connection";
import {
  getConnectedDevice,
  getAllDevices,
  getPairedDevices,
  getSerialDevices,
} from "./device-queries";

/**
 * Register the native disconnect listener once at module level so that
 * multiple components calling useConnectedDevice() don't each create their
 * own subscription.  The listener is bound lazily on the first call to
 * initDisconnectListener and never removed (lives for the app lifetime).
 */
let disconnectListenerBound = false;
function initDisconnectListener(client: QueryClient) {
  if (disconnectListenerBound) return;
  disconnectListenerBound = true;
  RNBluetoothClassic.onDeviceDisconnected(() => {
    // Clean up the scanner executor so the stale connection doesn't block
    // the next connectToDevice → setDevice call (isInitializing guard).
    void useScannerCommandExecutorStore.getState().setDevice(undefined);
    void client.invalidateQueries({ queryKey: ["connected-device"] });
  });
}

export function useConnectedDevice() {
  const client = useQueryClient();
  initDisconnectListener(client);

  const { data, isLoading, error } = useQuery({
    queryKey: ["connected-device"],
    queryFn: getConnectedDevice,
    networkMode: "always",
    // Poll so we catch disconnects even when the native
    // onDeviceDisconnected event doesn't fire (common on Android
    // when the device is simply powered off).
    refetchInterval: 3000,
  });

  // When polling detects a disconnect that the native listener missed,
  // clean up the command executor so the measurement page shows the
  // reconnect prompt instead of letting the user attempt a scan.
  const prevDeviceRef = useRef(data);
  useEffect(() => {
    const prev = prevDeviceRef.current;
    prevDeviceRef.current = data;

    if (prev && !data) {
      void useScannerCommandExecutorStore.getState().setDevice(undefined);
    }
  }, [data]);

  return { data, isLoading, error };
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

export function useSerialDevices() {
  return useQuery({
    queryKey: ["serial-devices"],
    queryFn: () => getSerialDevices(),
    refetchInterval: 2500,
    networkMode: "always",
  });
}
