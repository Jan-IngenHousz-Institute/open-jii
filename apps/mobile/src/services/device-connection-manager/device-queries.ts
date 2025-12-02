import RNBluetoothClassic from "react-native-bluetooth-classic";
import { listSerialPortDevices } from "~/services/multispeq-communication/android-serial-port-connection/open-serial-port-connection";
import { requestBluetoothPermission } from "~/services/request-bluetooth-permissions";
import type { Device } from "~/types/device";

import { bluetoothDeviceToDevice, isJiiDevice } from "./device-utils";
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
  const devices = await RNBluetoothClassic.startDiscovery();

  return devices.filter(isJiiDevice).map(bluetoothDeviceToDevice);
}

export async function getPairedDevices(): Promise<Device[]> {
  await requestBluetoothPermission();
  const bluetoothDevices = await RNBluetoothClassic.getBondedDevices();

  return bluetoothDevices.filter(isJiiDevice).map(bluetoothDeviceToDevice);
}

export async function getSerialDevices(): Promise<Device[]> {
  const serialDevices = await listSerialPortDevices();

  return serialDevices.map((d) => ({
    name:
      "USB " + d.deviceId.toString() + "/" + d.productId.toString() + "/" + d.vendorId.toString(),
    type: "usb",
    id: d.deviceId.toString(),
  }));
}
