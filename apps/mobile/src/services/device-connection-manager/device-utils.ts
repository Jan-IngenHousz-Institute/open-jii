import { BluetoothDevice } from "react-native-bluetooth-classic";
import type { Device } from "~/types/device";

export function bluetoothDeviceToDevice(d: BluetoothDevice): Device {
  return {
    id: d.address,
    type: "bluetooth-classic",
    name: d.name + " (" + d.id.slice(-11) + ")",
  };
}

export function isJiiDevice(device: { name: string }) {
  const name = device.name.toLowerCase();
  if (name.includes("multi")) {
    return true;
  }

  return name.includes("photo");
}
