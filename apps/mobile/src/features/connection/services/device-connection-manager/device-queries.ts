import RNBluetoothClassic from "react-native-bluetooth-classic";
import { listSerialPortDevices } from "~/features/connection/services/multispeq-communication/android-serial-port-connection/open-serial-port-connection";
import { listMockDevices } from "~/features/connection/services/multispeq-communication/mock-device/list-mock-devices";
import { getConnectedMockDevices } from "~/features/connection/services/multispeq-communication/mock-device/mock-device-registry";
import { mockDevicesEnabled } from "~/features/connection/services/multispeq-communication/mock-device/mock-devices-enabled";
import type { Device } from "~/shared/types/device";

import { bluetoothDeviceToDevice, serialDeviceToDevice } from "./device-utils";
import { getConnectedSerialPortDevices, pruneSerialPorts } from "./serial-port-connection";

export async function getConnectedDevices(): Promise<Device[]> {
  const present = await listSerialPortDevices().catch(() => []);
  // Unplug detection: drop registry entries no longer on the USB bus.
  pruneSerialPorts(new Set(present.map((d) => d.deviceId.toString())));

  // Transport exclusivity (see CONTEXT.md): serial devices win over the
  // single Bluetooth device, mirroring the previous serial-first preference.
  const serialDevices = getConnectedSerialPortDevices();
  if (serialDevices.length > 0) {
    return serialDevices;
  }

  if (mockDevicesEnabled) {
    const mockDevices = getConnectedMockDevices();
    if (mockDevices.length > 0) {
      return mockDevices;
    }
  }

  const [device] = await RNBluetoothClassic.getConnectedDevices();
  return device ? [bluetoothDeviceToDevice(device)] : [];
}

export async function getConnectedDevice(): Promise<Device | null> {
  const devices = await getConnectedDevices();
  return devices[0] ?? null;
}

export async function getAllDevices(): Promise<Device[]> {
  const [bluetoothResult, serialResult] = await Promise.allSettled([
    RNBluetoothClassic.startDiscovery(),
    listSerialPortDevices(),
  ]);

  const bluetoothDevices = bluetoothResult.status === "fulfilled" ? bluetoothResult.value : [];
  const serialDevices = serialResult.status === "fulfilled" ? serialResult.value : [];
  const mockDevices = mockDevicesEnabled ? await listMockDevices() : [];

  return [
    ...bluetoothDevices.map(bluetoothDeviceToDevice),
    ...serialDevices.map(serialDeviceToDevice),
    ...mockDevices,
  ];
}
