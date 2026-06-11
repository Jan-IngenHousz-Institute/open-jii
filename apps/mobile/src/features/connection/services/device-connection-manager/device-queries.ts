import RNBluetoothClassic from "react-native-bluetooth-classic";
import { listSerialPortDevices } from "~/features/connection/services/multispeq-communication/android-serial-port-connection/open-serial-port-connection";
import type { Device } from "~/shared/types/device";

import { getConnectedSerialPortDevice } from "./device-connection";
import { bluetoothDeviceToDevice, serialDeviceToDevice } from "./device-utils";

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
  const [bluetoothResult, serialResult] = await Promise.allSettled([
    RNBluetoothClassic.startDiscovery(),
    listSerialPortDevices(),
  ]);

  const bluetoothDevices = bluetoothResult.status === "fulfilled" ? bluetoothResult.value : [];
  const serialDevices = serialResult.status === "fulfilled" ? serialResult.value : [];

  return [
    ...bluetoothDevices.map(bluetoothDeviceToDevice),
    ...serialDevices.map(serialDeviceToDevice),
  ];
}
