import { useQuery } from "@tanstack/react-query";
import { getBluetoothClassicDevices } from "~/services/multispeq-communication/android-bluetooth-connection/get-bluetooth-classic-devices";
import { listSerialPortDevices } from "~/services/multispeq-communication/android-serial-port-connection/open-serial-port-connection";
import { listMockDevices } from "~/services/multispeq-communication/mock-device/list-mock-devices";
import { Device, DeviceType } from "~/types/device";

function getSerialDeviceName({ vendorId, productId }: { vendorId: number; productId: number }) {
  if (vendorId === 5824 && productId == 1155) {
    return "MultispeQ";
  }

  return `${vendorId}:${productId}`;
}

async function getDevices(type: DeviceType) {
  if (type === "bluetooth-classic") {
    const devices = await getBluetoothClassicDevices();
    return devices.map((device) => ({
      id: device.id,
      name: device.name + " (" + device.id.slice(-11) + ")",
      type: "bluetooth-classic",
      rssi: device.rssi?.valueOf(),
    })) satisfies Device[];
  }

  if (type === "usb") {
    const devices = await listSerialPortDevices();
    return devices.map((device) => ({
      id: device.deviceId.toString(),
      type: "usb",
      name: getSerialDeviceName(device),
    })) satisfies Device[];
  }

  if (type === "mock-device") {
    const devices = await listMockDevices();
    return devices.map((device) => ({
      id: device.id,
      name: device.name,
      type: "mock-device",
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
