import RNBluetoothClassic from "react-native-bluetooth-classic";
import { bluetoothDeviceToMultispeqStream } from "~/services/multispeq-communication/android-bluetooth-connection/bluetooth-device-to-multispeq-stream";
import { MultispeqCommandExecutor } from "~/services/multispeq-communication/multispeq-command-executor";
import { Device } from "~/types/device";

export async function createBluetoothMultiseqCommandExecutor(device: Device | undefined) {
  if (!device) {
    return undefined;
  }

  const bluetoothDevice = await RNBluetoothClassic.getConnectedDevice(device.id);
  return new MultispeqCommandExecutor(bluetoothDeviceToMultispeqStream(bluetoothDevice));
}
