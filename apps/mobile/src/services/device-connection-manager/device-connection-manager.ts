import RNBluetoothClassic from "react-native-bluetooth-classic";
import { Device } from "~/types/device";

export async function getConnectedDevice(): Promise<Device | undefined> {
  const [device] = await RNBluetoothClassic.getConnectedDevices();

  if (!device) {
    return undefined;
  }

  return {
    name: device.name,
    type: "bluetooth-classic",
    id: device.id,
  };
}
