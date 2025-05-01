import RNBluetoothClassic from "react-native-bluetooth-classic";

import { requestBluetoothPermission } from "../../request-bluetooth-permissions";

export async function getBluetoothClassicDevices() {
  await requestBluetoothPermission();
  try {
    await RNBluetoothClassic.cancelDiscovery();
  } catch (e) {
    // ignored
  }
  const devices = await RNBluetoothClassic.startDiscovery();
  return devices;
}
