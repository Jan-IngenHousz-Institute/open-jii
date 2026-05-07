import RNBluetoothClassic from "react-native-bluetooth-classic";
import { listSerialPortDevices } from "~/services/multispeq-communication/android-serial-port-connection/open-serial-port-connection";
import { requestBluetoothPermission } from "~/services/request-bluetooth-permissions";
import type { Device } from "~/types/device";

import { bluetoothDeviceToDevice } from "./device-utils";
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

  // Name-based filtering was removed in OJD-1487: MultispeQ units relabelled to
  // numeric IDs were being silently dropped. Probe-based identification lives
  // in getBluetoothClassicDevices() (the manual scan path); this query is
  // re-fetched on every connect/disconnect, so probing here would briefly tear
  // down the device the user just connected to.
  return devices.map(bluetoothDeviceToDevice);
}

export async function getPairedDevices(): Promise<Device[]> {
  await requestBluetoothPermission();
  const bluetoothDevices = await RNBluetoothClassic.getBondedDevices();

  return bluetoothDevices.map(bluetoothDeviceToDevice);
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
