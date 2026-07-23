import { openSerialPortConnection } from "~/features/connection/services/device-connection-manager/android-serial-port-connection/open-serial-port-connection";
import type { SerialPortEvents } from "~/features/connection/services/device-connection-manager/android-serial-port-connection/serial-port-events";
import { Emitter } from "~/features/connection/utils/emitter";
import { createLogger } from "~/shared/observability/logger";
import type { Device } from "~/shared/types/device";

const log = createLogger("serial-port-registry");

interface SerialPortEntry {
  device: Device;
  connection: Emitter<SerialPortEvents>;
}

// Device registry (see CONTEXT.md): all open USB serial ports keyed by
// Device.id (stringified Android deviceId). Insertion order = connect order;
// the first entry is the Primary device.
const serialPorts = new Map<string, SerialPortEntry>();

export function getSerialPortConnection(deviceId: string) {
  return serialPorts.get(deviceId)?.connection;
}

export function getConnectedSerialPortDevices(): Device[] {
  return Array.from(serialPorts.values(), (entry) => entry.device);
}

export async function openSerialPort(device: Device): Promise<void> {
  // Tear down any existing entry first; otherwise a reconnect after a device
  // reset leaks the old half-open port and every command fails "device not
  // open" until a manual replug.
  if (serialPorts.has(device.id)) {
    await closeSerialPort(device.id);
  }

  const connection = await openSerialPortConnection(parseInt(device.id));
  serialPorts.set(device.id, { device, connection });
}

export async function closeSerialPort(deviceId: string): Promise<void> {
  const entry = serialPorts.get(deviceId);
  if (!entry) {
    return;
  }

  serialPorts.delete(deviceId);
  await entry.connection
    .emit("destroy")
    .catch((e) => log.warn("serial port destroy failed", { err: (e as Error)?.message, deviceId }));
}

export async function closeAllSerialPorts(): Promise<void> {
  await Promise.allSettled(Array.from(serialPorts.keys(), (deviceId) => closeSerialPort(deviceId)));
}

/**
 * Close registry entries whose device is no longer present on the USB bus
 * (cross-checked against UsbSerialManager.list() by the connected-devices
 * poll). This is the unplug detector; the USB-serial lib has no detach
 * event, so without it an unplugged device would be reported as connected
 * forever. Returns the removed device ids.
 */
export function pruneSerialPorts(presentIds: ReadonlySet<string>): string[] {
  const removed: string[] = [];
  for (const deviceId of Array.from(serialPorts.keys())) {
    if (!presentIds.has(deviceId)) {
      removed.push(deviceId);
      void closeSerialPort(deviceId);
    }
  }
  return removed;
}
