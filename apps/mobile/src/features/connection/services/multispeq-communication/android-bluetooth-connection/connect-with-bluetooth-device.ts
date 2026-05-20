import RNBluetoothClassic from "react-native-bluetooth-classic";

export async function connectWithBluetoothDevice(deviceAddress: string) {
  try {
    const bondedDevices = await RNBluetoothClassic.getBondedDevices();
    let device = bondedDevices.find((d) => d.address === deviceAddress);
    if (!device) {
      device = await RNBluetoothClassic.pairDevice(deviceAddress);
      console.log("paired with device", device.name);
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
