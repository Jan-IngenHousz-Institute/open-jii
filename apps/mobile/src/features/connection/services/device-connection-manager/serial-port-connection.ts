import { openSerialPortConnection } from "~/features/connection/services/multispeq-communication/android-serial-port-connection/open-serial-port-connection";
import type { SerialPortEvents } from "~/features/connection/services/multispeq-communication/android-serial-port-connection/serial-port-events";
import { Emitter } from "~/features/connection/utils/emitter";
import type { Device } from "~/shared/types/device";

let serialPortConnection: Emitter<SerialPortEvents> | undefined;
let connectedSerialPortDevice: Device | undefined;

export function getConnectedSerialPortConnection() {
  return serialPortConnection;
}

export function getConnectedSerialPortDevice() {
  return connectedSerialPortDevice;
}

export async function setSerialPortConnection(device: Device | undefined) {
  if (device === undefined) {
    connectedSerialPortDevice = undefined;
    serialPortConnection?.emit("destroy");
    serialPortConnection = undefined;
    return;
  }

  serialPortConnection = await openSerialPortConnection(parseInt(device.id));
  connectedSerialPortDevice = device;
}
