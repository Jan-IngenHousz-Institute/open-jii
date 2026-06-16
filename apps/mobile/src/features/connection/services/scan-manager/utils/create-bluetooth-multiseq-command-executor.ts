import RNBluetoothClassic from "react-native-bluetooth-classic";
import { createDriverCommandExecutor } from "~/features/connection/services/multispeq-communication/driver-command-executor";
import { bluetoothClassicTransport } from "~/features/connection/services/multispeq-communication/transports/bluetooth-classic-transport";
import { Device } from "~/shared/types/device";

export async function createBluetoothMultiseqCommandExecutor(device: Device | undefined) {
  if (!device) {
    return undefined;
  }

  const bluetoothDevice = await RNBluetoothClassic.getConnectedDevice(device.id);
  return createDriverCommandExecutor(bluetoothClassicTransport(bluetoothDevice));
}
