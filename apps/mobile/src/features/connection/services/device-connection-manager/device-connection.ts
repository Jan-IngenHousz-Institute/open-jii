import RNBluetoothClassic from "react-native-bluetooth-classic";
import {
  closeMockDevice,
  openMockDevice,
} from "~/features/connection/services/multispeq-communication/mock-device/mock-device-registry";
import { mockDevicesEnabled } from "~/features/connection/services/multispeq-communication/mock-device/mock-devices-enabled";
import type { Device } from "~/shared/types/device";

import { closeSerialPort, openSerialPort } from "./serial-port-connection";

export async function connectToDevice(device: Device) {
  if (device.type === "bluetooth-classic") {
    // Always clean up any stale native socket first — after a BT toggle or
    // unexpected disconnect the old connection reference may still linger,
    // causing the next connectToDevice call to fail.
    try {
      await RNBluetoothClassic.disconnectFromDevice(device.id);
    } catch {
      // Already disconnected — expected.
    }

    try {
      await RNBluetoothClassic.connectToDevice(device.id);
    } catch {
      await RNBluetoothClassic.connectToDevice(device.id);
    }
    return;
  }

  if (device.type === "usb") {
    await openSerialPort(device);
    return;
  }

  if (device.type === "mock-device" && mockDevicesEnabled) {
    openMockDevice(device);
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
    await closeSerialPort(device.id);
    return;
  }
  if (device.type === "mock-device") {
    closeMockDevice(device.id);
  }
}

export async function unpairDevice(device: Device) {
  if (device.type === "bluetooth-classic") {
    await RNBluetoothClassic.unpairDevice(device.id);
    return;
  }

  throw new Error("Unsupported device type");
}
