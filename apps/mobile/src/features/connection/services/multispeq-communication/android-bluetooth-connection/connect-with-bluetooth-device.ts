import RNBluetoothClassic from "react-native-bluetooth-classic";
import { createLogger } from "~/shared/utils/logger";

const log = createLogger("bt-classic");

export async function connectWithBluetoothDevice(deviceAddress: string) {
  try {
    const bondedDevices = await RNBluetoothClassic.getBondedDevices();
    let device = bondedDevices.find((d) => d.address === deviceAddress);
    if (!device) {
      device = await RNBluetoothClassic.pairDevice(deviceAddress);
      log.info("paired with device", { name: device.name });
    }
    if (!(await device.isConnected())) {
      log.info("device not connected, connecting", { name: device.name });
      await device.connect();
    }
    log.info("connected to device", { name: device.name });
    return device;
  } catch (e) {
    log.error("error pairing", { err: (e as Error)?.message });
    throw e;
  }
}
