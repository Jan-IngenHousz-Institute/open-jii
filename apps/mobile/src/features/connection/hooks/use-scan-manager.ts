import { useMutation } from "@tanstack/react-query";
import { useDeviceConnectionStore } from "~/features/connection/hooks/use-device-connection-store";
import { useScannerCommandExecutor } from "~/features/connection/hooks/use-scanner-command-executor";

export function useScanner() {
  const { executeCommand, cancelCommand } = useScannerCommandExecutor();
  const { setBatteryLevel } = useDeviceConnectionStore();

  const mutation = useMutation({
    mutationFn: async (protocol: { code: Record<string, unknown>[] }) => {
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
    },
  });

  return {
    executeScan: mutation.mutateAsync,
    reset: mutation.reset,
    isScanning: mutation.isPending,
    error: mutation.error,
    result: mutation.data,
    executeCommand,
    cancelCommand,
  };
}
