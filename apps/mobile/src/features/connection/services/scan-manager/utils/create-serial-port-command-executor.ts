import { getConnectedSerialPortConnection } from "~/services/device-connection-manager/serial-port-connection";
import { serialPortToMultispeqStream } from "~/services/multispeq-communication/android-serial-port-connection/serial-port-to-multispeq-stream";
import { MultispeqCommandExecutor } from "~/services/multispeq-communication/multispeq-command-executor";

export function createSerialPortCommandExecutor() {
  const connection = getConnectedSerialPortConnection();
  if (!connection) {
    return undefined;
  }

  return new MultispeqCommandExecutor(serialPortToMultispeqStream(connection));
}
