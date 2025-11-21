import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
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

  return {
    connectingDeviceId,
    async connectToDevice(device: Device) {
      setConnectingDeviceId(device.id);
      try {
        await connectToDevice(device);
        await setDevice(device);
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
