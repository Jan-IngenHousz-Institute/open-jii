import RNBluetoothClassic from "react-native-bluetooth-classic";
import { listSerialPortDevices } from "~/features/connection/services/multispeq-communication/android-serial-port-connection/open-serial-port-connection";
import { hasBluetoothPermission } from "~/features/connection/services/request-bluetooth-permissions";
import type { Device } from "~/shared/types/device";

import { bluetoothDeviceToDevice, serialDeviceToDevice } from "./device-utils";
import { getConnectedSerialPortDevice } from "./serial-port-connection";

export async function getConnectedDevice(): Promise<Device | null> {
  const serialDevice = getConnectedSerialPortDevice();
  if (serialDevice) {
    return serialDevice;
  }

  const [device] = await RNBluetoothClassic.getConnectedDevices();

  if (!device) {
    return null;
  }

  return bluetoothDeviceToDevice(device);
}

export async function getAllDevices(): Promise<Device[]> {
  // USB serial discovery must never depend on Bluetooth: since the Bluetooth
  // permission became opt-in, calling startDiscovery() without it can reject
  // or hang, and folding both into a single allSettled would stall (or drop)
  // the serial results that are otherwise available immediately. Only scan for
  // Bluetooth devices when the permission is actually granted; always list
  // serial devices.
  const bluetoothDiscovery = (await hasBluetoothPermission())
    ? RNBluetoothClassic.startDiscovery()
    : Promise.resolve([]);

  const [bluetoothResult, serialResult] = await Promise.allSettled([
    bluetoothDiscovery,
    listSerialPortDevices(),
  ]);

  const bluetoothDevices = bluetoothResult.status === "fulfilled" ? bluetoothResult.value : [];
  const serialDevices = serialResult.status === "fulfilled" ? serialResult.value : [];

  return [
    ...bluetoothDevices.map(bluetoothDeviceToDevice),
    ...serialDevices.map(serialDeviceToDevice),
  ];
}
