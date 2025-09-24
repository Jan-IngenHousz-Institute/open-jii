import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import RNBluetoothClassic, { BluetoothDevice } from "react-native-bluetooth-classic";
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

function bluetoothDeviceToDevice(d: BluetoothDevice): Device {
  return {
    id: d.address,
    type: "bluetooth-classic",
    name: d.name + " (" + d.id.slice(-11) + ")",
  };
}

export async function getAllDevices(): Promise<Device[]> {
  await requestBluetoothPermission();
  const devices = await RNBluetoothClassic.startDiscovery();

  return devices.filter(isJiiDevice).map(bluetoothDeviceToDevice);
}

export async function getPairedDevices(): Promise<Device[]> {
  await requestBluetoothPermission();
  const devices = await RNBluetoothClassic.getBondedDevices();

  return devices.filter(isJiiDevice).map(bluetoothDeviceToDevice);
}

export async function unpairDevice(device: Device) {
  if (device.type === "bluetooth-classic") {
    await RNBluetoothClassic.unpairDevice(device.id);
    return;
  }

  throw new Error("Unsupported device type");
}

export async function connectToDevice(device: Device) {
  if (device.type === "bluetooth-classic") {
    try {
      await RNBluetoothClassic.connectToDevice(device.id);
    } catch {
      await RNBluetoothClassic.connectToDevice(device.id);
    }
    return;
  }

  throw new Error("Unsupported device type");
}

export async function disconnectFromDevice(device: Device) {
  await RNBluetoothClassic.disconnectFromDevice(device.id);
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
        await client.invalidateQueries({
          queryKey: ["paired-devices"],
        });
      } finally {
        setConnectingDeviceId(undefined);
      }
    },
    async disconnectFromDevice(device: Device) {
      await disconnectFromDevice(device);
      await client.invalidateQueries({
        queryKey: ["connected-device"],
      });
    },
    async unpairDevice(device: Device) {
      await unpairDevice(device);

      await client.invalidateQueries({
        queryKey: ["connected-device"],
      });

      await client.invalidateQueries({
        queryKey: ["paired-devices"],
      });
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

export function usePairedDevices() {
  return useQuery({
    queryKey: ["paired-devices"],
    queryFn: () => getPairedDevices(),
  });
}
