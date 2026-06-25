import type { BluetoothNativeDevice } from "react-native-bluetooth-classic";
import type { Device } from "~/shared/types/device";

const MULTISPEQ_VENDOR_ID = 5824;
const MULTISPEQ_PRODUCT_ID = 1155;

// Accepts both a bonded/connected BluetoothDevice and a discovered
// BluetoothNativeDevice (the onDeviceDiscovered payload); both carry these fields.
export function bluetoothDeviceToDevice(d: BluetoothNativeDevice): Device {
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
  return {
    id: d.deviceId.toString(),
    type: "usb",
    name: isMultispeq
      ? "MultispeQ"
      : `${d.vendorId.toString(16).padStart(4, "0")}:${d.productId.toString(16).padStart(4, "0")}`,
  };
}
