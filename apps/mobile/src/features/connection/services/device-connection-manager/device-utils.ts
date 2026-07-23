import type { BluetoothNativeDevice } from "react-native-bluetooth-classic";
import type { Device } from "~/shared/types/device";

const MULTISPEQ_VENDOR_ID = 5824;
const MULTISPEQ_PRODUCT_ID = 1155;

// Accepts a bonded/connected BluetoothDevice or a discovered BluetoothNativeDevice
// (the onDeviceDiscovered payload); both carry these fields. The payloads are
// unreliable, though: an entry can be present yet missing a usable address, so
// this guards and returns null rather than letting callers deref undefined.
export function bluetoothDeviceToDevice(
  d: BluetoothNativeDevice | null | undefined,
): Device | null {
  if (!d || typeof d.address !== "string" || d.address.length === 0) {
    return null;
  }
  // Keep the raw name even when it's just the MAC: many MultispeQs have no
  // friendly name, and the row still surfaces the bracketed sticker ID below it.
  return {
    id: d.address,
    type: "bluetooth-classic",
    name: d.name ?? "",
    rssi: d.rssi?.valueOf(),
  };
}

// The onDeviceDiscovered payload from react-native-bluetooth-classic is
// unreliable: the device may sit on `event.device`, be the event object itself,
// or be absent (a discovery-finished tick). Delegates to bluetoothDeviceToDevice,
// which returns null for anything without a usable address.
export function discoveredEventToDevice(event: unknown): Device | null {
  const e = event as { device?: BluetoothNativeDevice } | undefined;
  const native = (e?.device ?? e) as BluetoothNativeDevice | undefined;
  return bluetoothDeviceToDevice(native);
}

export function serialDeviceToDevice(d: {
  deviceId: number;
  vendorId: number;
  productId: number;
}): Device {
  const isMultispeq = d.vendorId === MULTISPEQ_VENDOR_ID && d.productId === MULTISPEQ_PRODUCT_ID;
  // Suffix the Android deviceId: identical devices on a hub would otherwise
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
