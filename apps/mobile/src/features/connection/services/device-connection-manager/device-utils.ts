import { BluetoothDevice } from "react-native-bluetooth-classic";
import type { Device } from "~/shared/types/device";

const MULTISPEQ_VENDOR_ID = 5824;
const MULTISPEQ_PRODUCT_ID = 1155;

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

export function serialDeviceToDevice(d: {
  deviceId: number;
  vendorId: number;
  productId: number;
}): Device {
  const isMultispeq = d.vendorId === MULTISPEQ_VENDOR_ID && d.productId === MULTISPEQ_PRODUCT_ID;
  // Suffix the Android deviceId: identical sensors on a hub would otherwise
  // render as indistinguishable rows in the device sheet and scan progress.
  const base = isMultispeq
    ? "MultispeQ"
    : `${d.vendorId.toString(16).padStart(4, "0")}:${d.productId.toString(16).padStart(4, "0")}`;
  return {
    id: d.deviceId.toString(),
    type: "usb",
    name: `${base} #${d.deviceId}`,
  };
}
