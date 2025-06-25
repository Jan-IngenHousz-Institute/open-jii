import { useAsyncCallback } from "react-async-hook";
import { getBluetoothClassicDevices } from "~/services/multispeq-communication/android-bluetooth-connection/get-bluetooth-classic-devices";

export interface Device {
  type: "bluetooth-classic" | "ble" | "usb";
  name: string;
  id: string;
  rssi?: number;
}

export function useDevices(type: "bluetooth-classic" | "ble" | "usb") {
  const {
    error,
    loading: isLoading,
    result: devices,
    execute: startScan,
  } = useAsyncCallback(async () => {
    const devices = await getBluetoothClassicDevices();

    return devices.map((device) => {
      return {
        id: device.id,
        name: device.name,
        type: "bluetooth-classic",
        rssi: device.rssi?.valueOf(),
      } satisfies Device;
    });
  });

  return { devices, isLoading, startScan, error };
}
