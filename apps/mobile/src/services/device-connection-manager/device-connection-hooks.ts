import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import RNBluetoothClassic from "react-native-bluetooth-classic";
import { useDeviceConnectionStore } from "~/hooks/use-device-connection-store";
import { useScannerCommandExecutorStore } from "~/stores/use-scanner-command-executor-store";
import type { Device } from "~/types/device";

import { connectToDevice, disconnectFromDevice, unpairDevice } from "./device-connection";
import {
  getConnectedDevice,
  getAllDevices,
  getPairedDevices,
  getSerialDevices,
} from "./device-queries";

export function useConnectedDevice() {
  const client = useQueryClient();

  // Subscribe to native disconnect events so the query updates instantly
  // instead of waiting for a poll cycle.
  useEffect(() => {
    const subscription = RNBluetoothClassic.onDeviceDisconnected(() => {
      void client.invalidateQueries({ queryKey: ["connected-device"] });
    });
    return () => subscription.remove();
  }, [client]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["connected-device"],
    queryFn: getConnectedDevice,
    networkMode: "always",
  });

  return { data, isLoading, error };
}

export function useConnectToDevice() {
  const client = useQueryClient();
  const [connectingDeviceId, setConnectingDeviceId] = useState<string>();
  const { setDevice } = useScannerCommandExecutorStore();
  const { setLastConnectedDevice } = useDeviceConnectionStore();

  return {
    connectingDeviceId,
    async connectToDevice(device: Device) {
      setConnectingDeviceId(device.id);
      try {
        await connectToDevice(device);
        await setDevice(device);
        // Remember this device so the measurement flow can offer an inline
        // reconnect button if the connection is lost during a session.
        setLastConnectedDevice(device);
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
      await setDevice(undefined);
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
      // Update scanner command executor store based on current connected device state
      // (in case the unpaired device was the connected one)
      const connectedDevice = await getConnectedDevice();
      await setDevice(connectedDevice ?? undefined);
    },
  };
}

export function useAllDevices() {
  return useQuery({
    queryKey: ["all-devices"],
    queryFn: () => getAllDevices(),
    enabled: false,
    networkMode: "always",
  });
}

export function usePairedDevices() {
  return useQuery({
    queryKey: ["paired-devices"],
    queryFn: () => getPairedDevices(),
    networkMode: "always",
  });
}

export function useSerialDevices() {
  return useQuery({
    queryKey: ["serial-devices"],
    queryFn: () => getSerialDevices(),
    refetchInterval: 2500,
    networkMode: "always",
  });
}
