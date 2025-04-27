import RNBluetoothClassic from "react-native-bluetooth-classic";

import { requestBluetoothPermission } from "./request-bluetooth-permissions";

export async function getBluetoothClassicDevices() {
  await requestBluetoothPermission();
  await RNBluetoothClassic.cancelDiscovery();
  const devices = await RNBluetoothClassic.startDiscovery();
  return devices;
}
