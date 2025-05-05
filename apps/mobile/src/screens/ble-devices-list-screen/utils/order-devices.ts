import type { BluetoothDevice } from "./bluetooth-device";

export function orderDevices(devices: BluetoothDevice[]): BluetoothDevice[] {
  return [...devices].sort((a, b) => {
    const keyA = a.name ? `0_${a.name}` : `1_${a.id}`;
    const keyB = b.name ? `0_${b.name}` : `1_${b.id}`;
    return keyA.localeCompare(keyB);
  });
}
