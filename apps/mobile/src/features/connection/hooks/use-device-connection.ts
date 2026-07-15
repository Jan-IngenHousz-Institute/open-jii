import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import RNBluetoothClassic from "react-native-bluetooth-classic";
import { useDeviceConnectionStore } from "~/features/connection/hooks/use-device-connection-store";
import { connectionKeys } from "~/features/connection/services/connection-keys";
import { closeAllSerialPorts } from "~/features/connection/services/device-connection-manager/serial-port-connection";
import { listMockDevices } from "~/features/connection/services/multispeq-communication/mock-device/list-mock-devices";
import { closeAllMockDevices } from "~/features/connection/services/multispeq-communication/mock-device/mock-device-registry";
import { mockDevicesEnabled } from "~/features/connection/services/multispeq-communication/mock-device/mock-devices-enabled";
import { useScannerCommandExecutorStore } from "~/features/connection/stores/use-scanner-command-executor-store";
import type { Device } from "~/shared/types/device";

import {
  connectToDevice,
  disconnectFromDevice,
  unpairDevice,
} from "../services/device-connection-manager/device-connection";
import { getConnectedDevices } from "../services/device-connection-manager/device-queries";
import { mergeDevice } from "../services/device-connection-manager/device-sort";
import {
  bluetoothDeviceToDevice,
  discoveredEventToDevice,
  serialDeviceToDevice,
} from "../services/device-connection-manager/device-utils";
import { listSerialPortDevices } from "../services/multispeq-communication/android-serial-port-connection/open-serial-port-connection";

function useConnectedDevicesQuery<T>(select: (devices: Device[]) => T) {
  return useQuery({
    queryKey: connectionKeys.connectedDevices,
    queryFn: getConnectedDevices,
    networkMode: "always",
    // Poll to catch disconnects the native event misses (common on Android when
    // powered off or unplugged); mountConnectionLifecycle turns each device's
    // disappearance into per-device executor cleanup.
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
  const { setDevice, addDevice, removeDevice } = useScannerCommandExecutorStore();
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
        await client.invalidateQueries({ queryKey: connectionKeys.connectedDevices });
      } finally {
        setConnectingDeviceId(undefined);
      }
    },
    async disconnectFromDevice(device: Device) {
      await disconnectFromDevice(device);
      await removeDevice(device.id);
      await client.invalidateQueries({ queryKey: connectionKeys.connectedDevices });
    },
    async unpairDevice(device: Device) {
      await unpairDevice(device);

      await client.invalidateQueries({ queryKey: connectionKeys.connectedDevices });

      // Drop only the unpaired device's executor (if it was connected at
      // all); every other connected device keeps running.
      await removeDevice(device.id);
    },
  };
}

/**
 * Streams nearby devices as the OS discovers them instead of blocking on the full
 * scan. Seeds with attached serial + bonded/connected BLE (+ mock devices when
 * enabled), then merges each discovery event. Return shape matches the previous
 * useQuery consumers.
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
    const [serial, bonded, connected, mocks] = await Promise.allSettled([
      listSerialPortDevices(),
      RNBluetoothClassic.getBondedDevices(),
      RNBluetoothClassic.getConnectedDevices(),
      mockDevicesEnabled ? listMockDevices() : Promise.resolve([]),
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
      ...(mocks.status === "fulfilled" ? mocks.value : []),
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
