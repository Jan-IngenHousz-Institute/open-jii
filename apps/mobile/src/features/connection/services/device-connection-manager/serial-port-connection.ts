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
 * The USB-serial lib emits no detach event, so a stale connection would keep
 * reporting "connected" after unplug (and the battery poller would keep hitting
 * a closed port with "device not open"). Drop the connection if the device is
 * no longer enumerated. Leaves it intact if the list can't be read, so a
 * transient failure doesn't false-disconnect a live device.
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
  if (device === undefined) {
    connectedSerialPortDevice = undefined;
    serialPortConnection?.emit("destroy");
    serialPortConnection = undefined;
    return;
  }

  serialPortConnection = await openSerialPortConnection(parseInt(device.id));
  connectedSerialPortDevice = device;
}
