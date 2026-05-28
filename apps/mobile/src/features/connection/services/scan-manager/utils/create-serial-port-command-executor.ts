import { getConnectedSerialPortConnection } from "~/features/connection/services/device-connection-manager/serial-port-connection";
import { serialPortToMultispeqStream } from "~/features/connection/services/multispeq-communication/android-serial-port-connection/serial-port-to-multispeq-stream";
import { MultispeqCommandExecutor } from "~/features/connection/services/multispeq-communication/multispeq-command-executor";

export function createSerialPortCommandExecutor() {
  const connection = getConnectedSerialPortConnection();
  if (!connection) {
    return undefined;
  }

  return new MultispeqCommandExecutor(serialPortToMultispeqStream(connection));
}
