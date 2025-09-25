import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import RNBluetoothClassic, { BluetoothDevice } from "react-native-bluetooth-classic";
import {
  listSerialPortDevices,
  openSerialPortConnection,
} from "~/services/multispeq-communication/android-serial-port-connection/open-serial-port-connection";
import type { SerialPortEvents } from "~/services/multispeq-communication/android-serial-port-connection/serial-port-events";
import { requestBluetoothPermission } from "~/services/request-bluetooth-permissions";
import { Device } from "~/types/device";
import { Emitter } from "~/utils/emitter";

let serialPortConnection: Emitter<SerialPortEvents> | undefined;
let connectedSerialPortDevice: Device | undefined;

export function getConnectedSerialPortConnection() {
  return serialPortConnection;
}

function bluetoothDeviceToDevice(d: BluetoothDevice): Device {
  return {
    id: d.address,
    type: "bluetooth-classic",
    name: d.name + " (" + d.id.slice(-11) + ")",
  };
}

export async function getConnectedDevice(): Promise<Device | null> {
  if (connectedSerialPortDevice) {
    return connectedSerialPortDevice;
  }

  const [device] = await RNBluetoothClassic.getConnectedDevices();

  if (!device) {
    return null;
  }

  return bluetoothDeviceToDevice(device);
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

  return devices.filter(isJiiDevice).map(bluetoothDeviceToDevice);
}

export async function getPairedDevices(): Promise<Device[]> {
  await requestBluetoothPermission();
  const bluetoothDevices = await RNBluetoothClassic.getBondedDevices();

  return bluetoothDevices.filter(isJiiDevice).map(bluetoothDeviceToDevice);
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

  if (device.type === "usb") {
    serialPortConnection = await openSerialPortConnection(parseInt(device.id));
    connectedSerialPortDevice = device;
    return;
  }

  throw new Error("Unsupported device type");
}

export async function disconnectFromDevice(device: Device) {
  if (device.type === "bluetooth-classic") {
    await RNBluetoothClassic.disconnectFromDevice(device.id);
    return;
  }
  if (device.type === "usb") {
    connectedSerialPortDevice = undefined;
    serialPortConnection?.emit("destroy");
    serialPortConnection = undefined;
  }
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

export async function getSerialDevices(): Promise<Device[]> {
  const serialDevices = await listSerialPortDevices();

  return serialDevices.map((d) => ({
    name:
      "USB " + d.deviceId.toString() + "/" + d.productId.toString() + "/" + d.vendorId.toString(),
    type: "usb",
    id: d.deviceId.toString(),
  }));
}

export function useSerialDevices() {
  return useQuery({
    queryKey: ["serial-devices"],
    queryFn: () => getSerialDevices(),
    refetchInterval: 2500,
  });
}
