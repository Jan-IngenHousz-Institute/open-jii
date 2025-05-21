import type { BluetoothDevice } from "./bluetooth-device";

export function orderDevices(devices: BluetoothDevice[]): BluetoothDevice[] {
  return [...devices].sort((a, b) => {
    const aName = a.name?.toLowerCase() || "";
    const bName = b.name?.toLowerCase() || "";

    const aHasMultispeq = aName.includes("multispeq");
    const bHasMultispeq = bName.includes("multispeq");

    if (aHasMultispeq && !bHasMultispeq) return -1;
    if (!aHasMultispeq && bHasMultispeq) return 1;

    const aKey = a.name ?? a.id;
    const bKey = b.name ?? b.id;

    return aKey.localeCompare(bKey);
  });
}
