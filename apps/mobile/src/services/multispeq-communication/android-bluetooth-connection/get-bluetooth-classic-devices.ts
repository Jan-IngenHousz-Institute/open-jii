import RNBluetoothClassic from "react-native-bluetooth-classic";

import { uniqBy } from "../../../utils/uniq";
import { requestBluetoothPermission } from "../../request-bluetooth-permissions";

export async function getBluetoothClassicDevices() {
  await requestBluetoothPermission();
  try {
    await RNBluetoothClassic.cancelDiscovery();
  } catch {
    // ignored
  }
  const [bondedDevices, connectedDevices, visibleDevices] = await Promise.all([
    RNBluetoothClassic.getBondedDevices(),
    RNBluetoothClassic.getConnectedDevices(),
    RNBluetoothClassic.startDiscovery(),
  ]);

  return uniqBy([...bondedDevices, ...connectedDevices, ...visibleDevices], (d) => d.id);
}
