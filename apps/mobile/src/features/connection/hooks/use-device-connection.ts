import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useDeviceConnectionStore } from "~/features/connection/hooks/use-device-connection-store";
import { connectionKeys } from "~/features/connection/services/connection-keys";
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
} from "../services/device-connection-manager/device-queries";

export function useConnectedDevice() {
  return useQuery({
    queryKey: connectionKeys.connectedDevice,
    queryFn: getConnectedDevice,
    networkMode: "always",
    // Poll so we catch disconnects even when the native
    // onDeviceDisconnected event doesn't fire (common on Android
    // when the device is simply powered off). mountConnectionLifecycle
    // (wired at app boot) turns these polling-detected transitions
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
        await client.invalidateQueries({ queryKey: connectionKeys.connectedDevice });
      } finally {
        setConnectingDeviceId(undefined);
      }
    },
    async disconnectFromDevice(device: Device) {
      await disconnectFromDevice(device);
      await setDevice(undefined);
      await client.invalidateQueries({ queryKey: connectionKeys.connectedDevice });
    },
    async unpairDevice(device: Device) {
      await unpairDevice(device);

      await client.invalidateQueries({ queryKey: connectionKeys.connectedDevice });

      // Update scanner command executor store based on current connected device state
      // (in case the unpaired device was the connected one)
      const connectedDevice = await getConnectedDevice();
      await setDevice(connectedDevice ?? undefined);
    },
  };
}

export function useAllDevices() {
  return useQuery({
    queryKey: connectionKeys.allDevices,
    queryFn: () => getAllDevices(),
    enabled: false,
    networkMode: "always",
  });
}
