import { BluetoothDevice } from "react-native-bluetooth-classic";
import type { Device } from "~/shared/types/device";

export function bluetoothDeviceToDevice(d: BluetoothDevice): Device {
  const hasName = !!d.name && d.name !== d.address;
  return {
    id: d.address,
    type: "bluetooth-classic",
    name: hasName ? d.name : "",
    rssi: d.rssi?.valueOf(),
  };
}
