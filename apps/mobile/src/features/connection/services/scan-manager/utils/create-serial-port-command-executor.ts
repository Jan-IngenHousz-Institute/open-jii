import { getConnectedSerialPortConnection } from "~/features/connection/services/device-connection-manager/serial-port-connection";
import { createDriverCommandExecutor } from "~/features/connection/services/multispeq-communication/driver-command-executor";
import { serialPortTransport } from "~/features/connection/services/multispeq-communication/transports/serial-port-transport";

export function createSerialPortCommandExecutor() {
  const connection = getConnectedSerialPortConnection();
  if (!connection) {
    return undefined;
  }

  return createDriverCommandExecutor(serialPortTransport(connection));
}
