import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import RNBluetoothClassic from "react-native-bluetooth-classic";
import { useDeviceConnectionStore } from "~/features/connection/hooks/use-device-connection-store";
import { connectionKeys } from "~/features/connection/services/connection-keys";
import { useScannerCommandExecutorStore } from "~/features/connection/stores/use-scanner-command-executor-store";
import type { Device } from "~/shared/types/device";

import {
  connectToDevice,
  disconnectFromDevice,
  unpairDevice,
} from "../services/device-connection-manager/device-connection";
import { getConnectedDevice } from "../services/device-connection-manager/device-queries";
import { mergeDevice } from "../services/device-connection-manager/device-sort";
import {
  bluetoothDeviceToDevice,
  discoveredEventToDevice,
  serialDeviceToDevice,
} from "../services/device-connection-manager/device-utils";
import { listSerialPortDevices } from "../services/multispeq-communication/android-serial-port-connection/open-serial-port-connection";

export function useConnectedDevice() {
  return useQuery({
    queryKey: connectionKeys.connectedDevice,
    queryFn: getConnectedDevice,
    networkMode: "always",
    // Poll to catch disconnects the native event misses (common on Android when
    // powered off); mountConnectionLifecycle turns the transition into cleanup.
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

/**
 * Streams nearby devices as the OS discovers them instead of blocking on the full
 * scan. Seeds with attached serial + bonded/connected BLE, then merges each
 * discovery event. Return shape matches the previous useQuery consumers.
 */
export function useAllDevices() {
  const [data, setData] = useState<Device[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    const sub = RNBluetoothClassic.onDeviceDiscovered((event) => {
      const device = discoveredEventToDevice(event);
      if (!device) return;
      setData((prev) => mergeDevice(prev, device));
    });
    return () => {
      mountedRef.current = false;
      sub.remove();
      void RNBluetoothClassic.cancelDiscovery().catch(() => undefined);
    };
  }, []);

  const refetch = useCallback(async () => {
    setIsFetching(true);
    await RNBluetoothClassic.cancelDiscovery().catch(() => undefined);
    // Seed with already-known devices (serial first) so the list isn't empty.
    const [serial, bonded, connected] = await Promise.allSettled([
      listSerialPortDevices(),
      RNBluetoothClassic.getBondedDevices(),
      RNBluetoothClassic.getConnectedDevices(),
    ]);
    // Bail if the sheet closed during the await: don't seed or restart a scan
    // with no active subscriber.
    if (!mountedRef.current) return;
    const seed = [
      ...(serial.status === "fulfilled" ? serial.value.map(serialDeviceToDevice) : []),
      // bluetoothDeviceToDevice is address-guarded and returns null for entries
      // without a usable address, so drop those rather than seeding bad rows.
      ...(bonded.status === "fulfilled"
        ? bonded.value.map(bluetoothDeviceToDevice).filter((d): d is Device => d !== null)
        : []),
      ...(connected.status === "fulfilled"
        ? connected.value.map(bluetoothDeviceToDevice).filter((d): d is Device => d !== null)
        : []),
    ].reduce<Device[]>(mergeDevice, []);
    setData(seed);
    try {
      await RNBluetoothClassic.startDiscovery();
    } catch {
      // No permission or scan failure; seeded/streamed results stay.
    } finally {
      if (mountedRef.current) setIsFetching(false);
    }
  }, []);

  return { data, refetch, isFetching };
}
