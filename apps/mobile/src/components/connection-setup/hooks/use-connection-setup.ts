import { useState } from "react";
import { useToast } from "~/context/toast-context";
import { useDeviceConnection } from "~/hooks/use-device-connection";
import { Device, DeviceType, useDevices } from "~/hooks/use-devices";

interface HookResult {
  selectedConnectionType: DeviceType | undefined;
  setSelectedConnectionType: (t: DeviceType) => void;
  loadingDevices: boolean;
  connectingDeviceId?: string;
  devices?: Device[];
  handleScanForDevices: () => Promise<void>;
  handleConnectToDevice: (device: Device) => Promise<void>;
}

export function useConnectionSetup(): HookResult {
  const { showToast } = useToast();
  const [selectedConnectionType, setSelectedConnectionType] = useState<DeviceType>();

  const { isLoading: loadingDevices, startScan, devices } = useDevices(selectedConnectionType);
  const { connect, connectingDeviceId } = useDeviceConnection();

  async function handleScanForDevices() {
    if (!selectedConnectionType) {
      showToast("Please select a connection type first", "info");
      return;
    }

    const scanResult = await startScan();

    if (scanResult.isError) {
      showToast("Failed to scan for devices", "error");
      return;
    }

    if (scanResult.data?.length === 0) {
      showToast("No devices found", "info");
    }
  }

  async function handleConnectToDevice(device: Device) {
    try {
      await connect(device);
      showToast(`Connected to ${device.name}`, "success");
    } catch {
      showToast("Connection failed", "error");
    }
  }

  return {
    selectedConnectionType,
    setSelectedConnectionType,
    loadingDevices,
    connectingDeviceId,
    devices,
    handleScanForDevices,
    handleConnectToDevice,
  };
}
