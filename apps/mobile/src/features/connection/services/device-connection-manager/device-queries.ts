import RNBluetoothClassic from "react-native-bluetooth-classic";
import { listSerialPortDevices } from "~/features/connection/services/device-connection-manager/android-serial-port-connection/open-serial-port-connection";
import { getConnectedMockDevices } from "~/features/connection/services/multispeq/mock-device/mock-device-registry";
import { mockDevicesEnabled } from "~/features/connection/services/multispeq/mock-device/mock-devices-enabled";
import type { Device } from "~/shared/types/device";

import { bluetoothDeviceToDevice } from "./device-utils";
import { getConnectedSerialPortDevices, pruneSerialPorts } from "./serial-port-connection";

export async function getConnectedDevices(): Promise<Device[]> {
  // Unplug detection: drop registry entries no longer on the USB bus (the
  // USB-serial lib has no detach event). Keep entries when the list can't be
  // read, so a transient failure won't false-disconnect.
  try {
    const present = await listSerialPortDevices();
    pruneSerialPorts(new Set(present.map((d) => d.deviceId.toString())));
  } catch {
    // Can't determine; keep the (possibly live) connections.
  }

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
  if (!device) {
    return [];
  }
  const mapped = bluetoothDeviceToDevice(device);
  return mapped ? [mapped] : [];
}

export async function getConnectedDevice(): Promise<Device | null> {
  const devices = await getConnectedDevices();
  return devices[0] ?? null;
}
