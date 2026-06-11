import RNBluetoothClassic from "react-native-bluetooth-classic";
import { bluetoothDeviceToMultispeqStream } from "~/features/connection/services/multispeq-communication/android-bluetooth-connection/bluetooth-device-to-multispeq-stream";
import { openSerialPortConnection } from "~/features/connection/services/multispeq-communication/android-serial-port-connection/open-serial-port-connection";
import type { SerialPortEvents } from "~/features/connection/services/multispeq-communication/android-serial-port-connection/serial-port-events";
import { serialPortToMultispeqStream } from "~/features/connection/services/multispeq-communication/android-serial-port-connection/serial-port-to-multispeq-stream";
import { MultispeqCommandExecutor } from "~/features/connection/services/multispeq-communication/multispeq-command-executor";
import type { Emitter } from "~/features/connection/utils/emitter";
import type { Device, DeviceType } from "~/shared/types/device";

// The single decision table over device transports. Adding a transport =
// adding one entry here; nothing else in the app switches on device.type.
interface DeviceTypeOps {
  connect(device: Device): Promise<void>;
  disconnect(device: Device): Promise<void>;
  unpair?(device: Device): Promise<void>;
  createExecutor(device: Device): Promise<MultispeqCommandExecutor | undefined>;
}

const bluetoothClassicOps: DeviceTypeOps = {
  async connect(device) {
    // Always clean up any stale native socket first — after a BT toggle or
    // unexpected disconnect the old connection reference may still linger,
    // causing the next connectToDevice call to fail.
    try {
      await RNBluetoothClassic.disconnectFromDevice(device.id);
    } catch {
      // Already disconnected — expected.
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
    return new MultispeqCommandExecutor(bluetoothDeviceToMultispeqStream(bluetoothDevice));
  },
};

// One serial connection per app; held in module closure (the OS only exposes
// a single CDC port anyway).
let serialPortConnection: Emitter<SerialPortEvents> | undefined;
let connectedSerialPortDevice: Device | undefined;

export function getConnectedSerialPortDevice(): Device | undefined {
  return connectedSerialPortDevice;
}

const usbOps: DeviceTypeOps = {
  async connect(device) {
    serialPortConnection = await openSerialPortConnection(parseInt(device.id));
    connectedSerialPortDevice = device;
  },
  disconnect() {
    connectedSerialPortDevice = undefined;
    serialPortConnection?.emit("destroy");
    serialPortConnection = undefined;
    return Promise.resolve();
  },
  // eslint-disable-next-line @typescript-eslint/require-await
  async createExecutor() {
    if (!serialPortConnection) return undefined;
    return new MultispeqCommandExecutor(serialPortToMultispeqStream(serialPortConnection));
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
): Promise<MultispeqCommandExecutor | undefined> {
  return deviceOps[device.type].createExecutor(device);
}
