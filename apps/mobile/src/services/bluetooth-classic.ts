import RNBluetoothClassic from "react-native-bluetooth-classic";

import { requestBluetoothPermission } from "./request-bluetooth-permissions";

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

export async function connectWithBluetoothDevice(deviceAddress: string) {
  try {
    const bondedDevices = await RNBluetoothClassic.getBondedDevices();
    let device = bondedDevices.find((d) => d.address === deviceAddress);
    console.log("found device", device);
    if (!device) {
      device = await RNBluetoothClassic.pairDevice(deviceAddress);
      console.log("paired with device", device);
    }
    if (!(await device.isConnected())) {
      console.log("device not connected, connecting...");
      await device.connect();
    }
    console.log("connected to device");
    return device;
  } catch (e) {
    console.log("error pairing", e);
    throw e;
  }
}
