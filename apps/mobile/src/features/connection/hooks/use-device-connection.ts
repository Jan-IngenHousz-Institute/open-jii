import { QueryClient, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import RNBluetoothClassic from "react-native-bluetooth-classic";
import { useDeviceConnectionStore } from "~/features/connection/hooks/use-device-connection-store";
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
  serialDeviceToDevice,
} from "../services/device-connection-manager/device-utils";
import { listSerialPortDevices } from "../services/multispeq-communication/android-serial-port-connection/open-serial-port-connection";

const CONNECTED_DEVICE_KEY = ["connected-device"] as const;

/**
 * Binds two app-wide listeners that clear the scanner executor when the device
 * goes null: the native onDeviceDisconnected, and a QueryCache subscriber that
 * also catches the polled-disconnect case Android gives instead of an event.
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
    // Poll to catch disconnects the native event misses (common on Android).
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

  useEffect(() => {
    const sub = RNBluetoothClassic.onDeviceDiscovered((event) => {
      setData((prev) => mergeDevice(prev, bluetoothDeviceToDevice(event.device)));
    });
    return () => {
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
    const seed = [
      ...(serial.status === "fulfilled" ? serial.value.map(serialDeviceToDevice) : []),
      ...(bonded.status === "fulfilled" ? bonded.value.map(bluetoothDeviceToDevice) : []),
      ...(connected.status === "fulfilled" ? connected.value.map(bluetoothDeviceToDevice) : []),
    ].reduce<Device[]>(mergeDevice, []);
    setData(seed);
    try {
      await RNBluetoothClassic.startDiscovery();
    } catch {
      // No permission or scan failure; seeded/streamed results stay.
    } finally {
      setIsFetching(false);
    }
  }, []);

  return { data, refetch, isFetching };
}
