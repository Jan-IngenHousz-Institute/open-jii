import {
  listSerialPortDevices,
  openSerialPortConnection,
} from "~/features/connection/services/multispeq-communication/android-serial-port-connection/open-serial-port-connection";
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

/**
 * The USB-serial lib has no detach event, so a stale connection keeps reporting
 * "connected" after unplug. Drop it if the device is no longer enumerated; keep
 * it if the list can't be read, so a transient failure won't false-disconnect.
 */
export async function verifyConnectedSerialPortDevice(): Promise<void> {
  const device = connectedSerialPortDevice;
  if (!device) return;
  try {
    const attached = (await listSerialPortDevices()).some((d) => String(d.deviceId) === device.id);
    if (!attached) await setSerialPortConnection(undefined);
  } catch {
    // Can't determine; keep the (possibly live) connection.
  }
}

export async function setSerialPortConnection(device: Device | undefined) {
  // Tear down any existing connection first; otherwise a reconnect leaks the old
  // half-open port and every command fails "device not open" until a manual reset.
  serialPortConnection?.emit("destroy");
  serialPortConnection = undefined;
  connectedSerialPortDevice = undefined;

  if (device === undefined) return;

  serialPortConnection = await openSerialPortConnection(parseInt(device.id));
  connectedSerialPortDevice = device;
}
