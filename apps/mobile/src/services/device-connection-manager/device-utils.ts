import { BluetoothDevice } from "react-native-bluetooth-classic";
import type { Device } from "~/types/device";

export function bluetoothDeviceToDevice(d: BluetoothDevice): Device {
  return {
    id: d.address,
    type: "bluetooth-classic",
    name: d.name + " (" + d.id.slice(-11) + ")",
  };
}
