import RNBluetoothClassic from "react-native-bluetooth-classic";
import { createDriverCommandExecutor } from "~/features/connection/services/multispeq-communication/driver-command-executor";
import type { IMultispeqCommandExecutor } from "~/features/connection/services/multispeq-communication/driver-command-executor";
import { bluetoothClassicTransport } from "~/features/connection/services/multispeq-communication/transports/bluetooth-classic-transport";
import { serialPortTransport } from "~/features/connection/services/multispeq-communication/transports/serial-port-transport";
import type { Device, DeviceType } from "~/shared/types/device";

import {
  getConnectedSerialPortConnection,
  setSerialPortConnection,
} from "./serial-port-connection";

// The single decision table over device transports. Adding a transport =
// adding one entry here; nothing else in the app switches on device.type.
// Executors are built from the shared @repo/iot driver via per-transport
// adapters (transports/), which also handle MultispeQ frame parsing.
interface DeviceTypeOps {
  connect(device: Device): Promise<void>;
  disconnect(device: Device): Promise<void>;
  unpair?(device: Device): Promise<void>;
  createExecutor(device: Device): Promise<IMultispeqCommandExecutor | undefined>;
}

const bluetoothClassicOps: DeviceTypeOps = {
  async connect(device) {
    // Always clean up any stale native socket first: after a BT toggle or
    // unexpected disconnect the old connection reference may still linger,
    // causing the next connectToDevice call to fail.
    try {
      await RNBluetoothClassic.disconnectFromDevice(device.id);
    } catch {
      // Already disconnected, expected.
    }

    try {
      await RNBluetoothClassic.connectToDevice(device.id);
    } catch {
      await RNBluetoothClassic.connectToDevice(device.id);
    }
  },
  async disconnect(device) {
    try {
      await RNBluetoothClassic.disconnectFromDevice(device.id);
    } catch {
      // no action, we're already disconnected
    }
  },
  async unpair(device) {
    await RNBluetoothClassic.unpairDevice(device.id);
  },
  async createExecutor(device) {
    const bluetoothDevice = await RNBluetoothClassic.getConnectedDevice(device.id);
    return createDriverCommandExecutor(bluetoothClassicTransport(bluetoothDevice));
  },
};

// Serial state (with USB-unplug detection + teardown-before-reconnect) lives in
// serial-port-connection.ts; usbOps just delegates so device-queries and the
// executor read one source of truth.
const usbOps: DeviceTypeOps = {
  async connect(device) {
    await setSerialPortConnection(device);
  },
  async disconnect() {
    await setSerialPortConnection(undefined);
  },
  // eslint-disable-next-line @typescript-eslint/require-await
  async createExecutor() {
    const connection = getConnectedSerialPortConnection();
    if (!connection) return undefined;
    return createDriverCommandExecutor(serialPortTransport(connection));
  },
};

// Dev-only scan-list entries; not connectable.
const mockDeviceOps: DeviceTypeOps = {
  connect: () => Promise.reject(new Error("Unsupported device type")),
  disconnect: () => Promise.resolve(),
  createExecutor: () => Promise.reject(new Error("Unsupported device type")),
};

const deviceOps: Record<DeviceType, DeviceTypeOps> = {
  "bluetooth-classic": bluetoothClassicOps,
  usb: usbOps,
  "mock-device": mockDeviceOps,
};

export async function connectToDevice(device: Device): Promise<void> {
  await deviceOps[device.type].connect(device);
}

export async function disconnectFromDevice(device: Device): Promise<void> {
  await deviceOps[device.type].disconnect(device);
}

export async function unpairDevice(device: Device): Promise<void> {
  const unpair = deviceOps[device.type].unpair;
  if (!unpair) throw new Error("Unsupported device type");
  await unpair(device);
}

export async function createCommandExecutor(
  device: Device,
): Promise<IMultispeqCommandExecutor | undefined> {
  return deviceOps[device.type].createExecutor(device);
}
