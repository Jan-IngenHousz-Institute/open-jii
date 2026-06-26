import RNBluetoothClassic from "react-native-bluetooth-classic";
import type { Device } from "~/shared/types/device";

import { bluetoothDeviceToDevice } from "./device-utils";
import {
  getConnectedSerialPortDevice,
  verifyConnectedSerialPortDevice,
} from "./serial-port-connection";

export async function getConnectedDevice(): Promise<Device | null> {
  // Drop a stale serial connection if the USB device was unplugged (the lib has
  // no detach event), so this polled query reflects a real disconnect.
  await verifyConnectedSerialPortDevice();
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
