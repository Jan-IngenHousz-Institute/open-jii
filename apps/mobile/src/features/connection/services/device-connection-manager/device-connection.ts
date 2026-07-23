import RNBluetoothClassic from "react-native-bluetooth-classic";
import type { DeviceCommandExecutor } from "~/features/connection/services/device-command-executor";
import { createMockCommandExecutor } from "~/features/connection/services/multispeq/mock-device/create-mock-command-executor";
import {
  closeMockDevice,
  openMockDevice,
} from "~/features/connection/services/multispeq/mock-device/mock-device-registry";
import { mockDevicesEnabled } from "~/features/connection/services/multispeq/mock-device/mock-devices-enabled";
import { createMultispeqCommandExecutor } from "~/features/connection/services/multispeq/multispeq-command-executor";
import { bluetoothClassicTransport } from "~/features/connection/services/multispeq/transports/bluetooth-classic-transport";
import { serialPortTransport } from "~/features/connection/services/multispeq/transports/serial-port-transport";
import type { Device, DeviceType } from "~/shared/types/device";

import { closeSerialPort, getSerialPortConnection, openSerialPort } from "./serial-port-connection";

// The single decision table over device transports. Adding a transport =
// adding one entry here; nothing else in the app switches on device.type.
// Executors are built from the shared @repo/iot driver via per-transport
// adapters (transports/), which also handle MultispeQ frame parsing.
interface DeviceTypeOps {
  connect(device: Device): Promise<void>;
  disconnect(device: Device): Promise<void>;
  unpair?(device: Device): Promise<void>;
  createExecutor(device: Device): Promise<DeviceCommandExecutor | undefined>;
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
    return createMultispeqCommandExecutor(bluetoothClassicTransport(bluetoothDevice));
  },
};

// Serial state (Device registry with prune-based unplug detection and
// teardown-before-reconnect) lives in serial-port-connection.ts; usbOps just
// delegates so device-queries and the executor read one source of truth.
const usbOps: DeviceTypeOps = {
  async connect(device) {
    await openSerialPort(device);
  },
  async disconnect(device) {
    await closeSerialPort(device.id);
  },
  // eslint-disable-next-line @typescript-eslint/require-await
  async createExecutor(device) {
    const connection = getSerialPortConnection(device.id);
    if (!connection) return undefined;
    return createMultispeqCommandExecutor(serialPortTransport(connection));
  },
};

// Dev-only devices backed by an in-memory registry; connectable only when
// mock devices are enabled so the multi-scan UI can be exercised without
// hardware.
const mockDeviceOps: DeviceTypeOps = {
  connect(device) {
    if (!mockDevicesEnabled) return Promise.reject(new Error("Unsupported device type"));
    openMockDevice(device);
    return Promise.resolve();
  },
  disconnect(device) {
    closeMockDevice(device.id);
    return Promise.resolve();
  },
  createExecutor(device) {
    if (!mockDevicesEnabled) return Promise.reject(new Error("Unsupported device type"));
    return Promise.resolve(createMockCommandExecutor(device.id));
  },
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

export async function createDeviceCommandExecutor(
  device: Device,
): Promise<DeviceCommandExecutor | undefined> {
  return deviceOps[device.type].createExecutor(device);
}
