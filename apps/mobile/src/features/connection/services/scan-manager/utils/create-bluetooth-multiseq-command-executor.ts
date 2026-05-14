import RNBluetoothClassic from "react-native-bluetooth-classic";
import { bluetoothDeviceToMultispeqStream } from "~/features/connection/services/multispeq-communication/android-bluetooth-connection/bluetooth-device-to-multispeq-stream";
import { MultispeqCommandExecutor } from "~/features/connection/services/multispeq-communication/multispeq-command-executor";
import { Device } from "~/shared/types/device";

export async function createBluetoothMultiseqCommandExecutor(device: Device | undefined) {
  if (!device) {
    return undefined;
  }

  const bluetoothDevice = await RNBluetoothClassic.getConnectedDevice(device.id);
  return new MultispeqCommandExecutor(bluetoothDeviceToMultispeqStream(bluetoothDevice));
}
