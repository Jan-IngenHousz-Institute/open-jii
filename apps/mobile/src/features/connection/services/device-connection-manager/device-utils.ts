import { BluetoothDevice } from "react-native-bluetooth-classic";
import type { Device } from "~/shared/types/device";

export function bluetoothDeviceToDevice(d: BluetoothDevice): Device {
  // Keep the raw name even when it's just the MAC: many MultispeQs have no
  // friendly name, and the row still surfaces the bracketed sticker ID below it.
  return {
    id: d.address,
    type: "bluetooth-classic",
    name: d.name ?? "",
    rssi: d.rssi?.valueOf(),
  };
}
