import { useAsyncCallback } from "react-async-hook";
import { useDeviceConnectionStore } from "~/hooks/use-device-connection-store";
import { useScannerCommandExecutor } from "~/services/scan-manager/use-scanner-command-executor";

export function useScanner() {
  const { executeCommand } = useScannerCommandExecutor();

  const { setBatteryLevel } = useDeviceConnectionStore();

  const {
    execute: executeScan,
    reset,
    loading: isScanning,
    error,
    result,
  } = useAsyncCallback(async (protocol: { code: Record<string, unknown>[] }) => {
    const protocolCode = protocol.code;
    if (!protocolCode) {
      return;
    }

    const result = await executeCommand(protocolCode);

    setBatteryLevel((result as any)?.device_battery);
    if (typeof result !== "object") {
      throw new Error("Invalid result");
    }

    return result;
  });

  return {
    executeScan,
    reset,
    isScanning,
    error,
    result,
    executeCommand,
  };
}
