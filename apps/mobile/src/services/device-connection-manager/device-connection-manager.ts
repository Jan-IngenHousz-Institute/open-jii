import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import RNBluetoothClassic from "react-native-bluetooth-classic";
import { requestBluetoothPermission } from "~/services/request-bluetooth-permissions";
import { Device } from "~/types/device";

export async function getConnectedDevice(): Promise<Device | null> {
  const [device] = await RNBluetoothClassic.getConnectedDevices();

  if (!device) {
    return null;
  }

  return {
    name: device.name,
    type: "bluetooth-classic",
    id: device.id,
  };
}

function isJiiDevice(device: { name: string }) {
  const name = device.name.toLowerCase();
  if (name.includes("multi")) {
    return true;
  }

  return name.includes("photo");
}

export async function getAllDevices(): Promise<Device[]> {
  await requestBluetoothPermission();
  const devices = await RNBluetoothClassic.startDiscovery();

  return devices.filter(isJiiDevice).map((d) => ({
    id: d.address,
    type: "bluetooth-classic",
    name: d.name + " (" + d.id.slice(-11) + ")",
  }));
}

export async function connectToDevice(device: Device) {
  await RNBluetoothClassic.connectToDevice(device.id);
}

export function useConnectedDevice() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["connected-device"],
    queryFn: () => getConnectedDevice(),
  });

  return { data, isLoading, error };
}

export function useConnectToDevice() {
  const client = useQueryClient();
  const [connectingDeviceId, setConnectingDeviceId] = useState<string>();

  return {
    connectingDeviceId,
    async connectToDevice(device: Device) {
      setConnectingDeviceId(device.id);
      try {
        await connectToDevice(device);
        await client.invalidateQueries({
          queryKey: ["connected-device"],
        });
      } finally {
        setConnectingDeviceId(undefined);
      }
    },
  };
}

export function useAllDevices() {
  return useQuery({
    queryKey: ["all-devices"],
    queryFn: () => getAllDevices(),
    enabled: false,
  });
}
