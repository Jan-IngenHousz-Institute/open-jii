import type { BluetoothDevice } from "react-native-bluetooth-classic";

export function compareBluetoothDevices(
  a: BluetoothDevice,
  b: BluetoothDevice,
): number {
  const aName = a.name?.toLowerCase() ?? "";
  const bName = b.name?.toLowerCase() ?? "";

  const aPriority =
    aName.includes("photosynq") || aName.includes("multispeq") ? 0 : 1;
  const bPriority =
    bName.includes("photosynq") || bName.includes("multispeq") ? 0 : 1;

  if (aPriority !== bPriority) {
    return aPriority - bPriority;
  }

  if (aName !== bName) {
    return aName.localeCompare(bName);
  }

  const aBonded = a.bonded ? 0 : 1;
  const bBonded = b.bonded ? 0 : 1;

  return aBonded - bBonded;
}
