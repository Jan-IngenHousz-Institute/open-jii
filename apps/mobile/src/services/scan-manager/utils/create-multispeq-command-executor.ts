import { createBluetoothMultiseqCommandExecutor } from "~/services/scan-manager/utils/create-bluetooth-multiseq-command-executor";
import { createSerialPortCommandExecutor } from "~/services/scan-manager/utils/create-serial-port-command-executor";
import { Device } from "~/types/device";

export async function createMultispeqCommandExecutor(device: Device | undefined) {
  if (!device) {
    return undefined;
  }

  if (device.type === "bluetooth-classic") {
    return createBluetoothMultiseqCommandExecutor(device);
  }

  if (device.type === "usb") {
    return createSerialPortCommandExecutor();
  }

  throw new Error("Unsupported device type");
}
