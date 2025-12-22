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

  return _.uniqBy([...bondedDevices, ...connectedDevices, ...visibleDevices], "id").filter((d) => {
    const name = d.name?.toLowerCase() ?? "";
    const includesMulti = name.includes("multi");
    const includesPhoto = name.includes("photo");
    return includesMulti ?? includesPhoto;
  });
}
