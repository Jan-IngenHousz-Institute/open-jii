import RNBluetoothClassic from "react-native-bluetooth-classic";
import { listSerialPortDevices } from "~/features/connection/services/multispeq-communication/android-serial-port-connection/open-serial-port-connection";
import { requestBluetoothPermission } from "~/features/connection/services/request-bluetooth-permissions";
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
  await requestBluetoothPermission();
  const [bluetoothDevices, serialDevices] = await Promise.all([
    RNBluetoothClassic.startDiscovery(),
    listSerialPortDevices(),
  ]);

  return [
    ...bluetoothDevices.map(bluetoothDeviceToDevice),
    ...serialDevices.map(serialDeviceToDevice),
  ];
}

export async function getPairedDevices(): Promise<Device[]> {
  await requestBluetoothPermission();
  const bluetoothDevices = await RNBluetoothClassic.getBondedDevices();

  return bluetoothDevices.map(bluetoothDeviceToDevice);
}
