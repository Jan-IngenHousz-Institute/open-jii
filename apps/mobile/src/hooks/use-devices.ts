import { useQuery } from "@tanstack/react-query";
import { getBluetoothClassicDevices } from "~/services/multispeq-communication/android-bluetooth-connection/get-bluetooth-classic-devices";
import { listSerialPortDevices } from "~/services/multispeq-communication/android-serial-port-connection/open-serial-port-connection";

export type DeviceType = "bluetooth-classic" | "ble" | "usb";

export interface Device {
  type: DeviceType;
  name: string;
  id: string;
  rssi?: number;
}

async function getDevices(type: DeviceType) {
  if (type === "bluetooth-classic") {
    const devices = await getBluetoothClassicDevices();
    return devices.map((device) => ({
      id: device.id,
      name: device.name,
      type: "bluetooth-classic",
      rssi: device.rssi?.valueOf(),
    })) satisfies Device[];
  }

  if (type === "usb") {
    const devices = await listSerialPortDevices();
    console.log("devices", devices);
    return devices.map((device) => ({
      id: device.deviceId.toString(),
      type: "usb",
      name: device.productId.toString(),
    })) satisfies Device[];
  }

  return [];
}

export function useDevices(type: DeviceType | undefined) {
  const {
    data: devices,
    isFetching: isLoading,
    error,
    refetch: startScan,
  } = useQuery({
    queryKey: ["getDevices", type],
    queryFn: () => type && getDevices(type),
    enabled: false,
  });

  return { devices: isLoading ? undefined : devices, isLoading, startScan, error };
}
