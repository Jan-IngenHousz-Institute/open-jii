import _ from "lodash";
import RNBluetoothClassic from "react-native-bluetooth-classic";

import { requestBluetoothPermission } from "../../request-bluetooth-permissions";

export async function getBluetoothClassicDevices() {
  await requestBluetoothPermission();
  try {
    await RNBluetoothClassic.cancelDiscovery();
  } catch (e) {
    // ignored
  }
  const [connectedDevices, visibleDevices] = await Promise.all([
    RNBluetoothClassic.getConnectedDevices(),
    RNBluetoothClassic.startDiscovery(),
  ]);

  return _.uniqBy([...connectedDevices, ...visibleDevices], "id");
}
