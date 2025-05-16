import _ from "lodash";
import RNBluetoothClassic from "react-native-bluetooth-classic";

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

  return _.uniqBy([...bondedDevices, ...connectedDevices, ...visibleDevices], "id");
}
