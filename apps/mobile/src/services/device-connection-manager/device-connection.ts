import RNBluetoothClassic from "react-native-bluetooth-classic";
import type { Device } from "~/types/device";

import { setSerialPortConnection } from "./serial-port-connection";

export async function connectToDevice(device: Device) {
  if (device.type === "bluetooth-classic") {
    try {
      await RNBluetoothClassic.connectToDevice(device.id);
    } catch {
      await RNBluetoothClassic.connectToDevice(device.id);
    }
    return;
  }

  if (device.type === "usb") {
    await setSerialPortConnection(device);
    return;
  }

  throw new Error("Unsupported device type");
}

export async function disconnectFromDevice(device: Device) {
  if (device.type === "bluetooth-classic") {
    try {
      await RNBluetoothClassic.disconnectFromDevice(device.id);
    } catch {
      // no action, we're already disconnected
    }
    return;
  }
  if (device.type === "usb") {
    await setSerialPortConnection(undefined);
  }
}

export async function unpairDevice(device: Device) {
  if (device.type === "bluetooth-classic") {
    await RNBluetoothClassic.unpairDevice(device.id);
    return;
  }

  throw new Error("Unsupported device type");
}
