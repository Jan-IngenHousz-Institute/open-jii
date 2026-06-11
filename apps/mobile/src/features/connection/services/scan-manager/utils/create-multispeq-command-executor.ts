import { createMockCommandExecutor } from "~/features/connection/services/multispeq-communication/mock-device/create-mock-command-executor";
import { mockDevicesEnabled } from "~/features/connection/services/multispeq-communication/mock-device/mock-devices-enabled";
import { createBluetoothMultiseqCommandExecutor } from "~/features/connection/services/scan-manager/utils/create-bluetooth-multiseq-command-executor";
import { createSerialPortCommandExecutor } from "~/features/connection/services/scan-manager/utils/create-serial-port-command-executor";
import { Device } from "~/shared/types/device";

export async function createMultispeqCommandExecutor(device: Device | undefined) {
  if (!device) {
    return undefined;
  }

  if (device.type === "bluetooth-classic") {
    return createBluetoothMultiseqCommandExecutor(device);
  }

  if (device.type === "usb") {
    return createSerialPortCommandExecutor(device.id);
  }

  if (device.type === "mock-device" && mockDevicesEnabled) {
    return createMockCommandExecutor(device.id);
  }

  throw new Error("Unsupported device type");
}
