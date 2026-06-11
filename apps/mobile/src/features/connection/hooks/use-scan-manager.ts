import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useScannerCommandExecutor } from "~/features/connection/hooks/use-scanner-command-executor";
import { connectionKeys } from "~/features/connection/services/connection-keys";
import type { Device } from "~/shared/types/device";

export function useScanner() {
  const { executeCommand, cancelCommand, progress, scanStartedAt, estimatedMs } =
    useScannerCommandExecutor();
  const client = useQueryClient();

  const mutation = useMutation({
    networkMode: "always",
    mutationFn: async (protocol: { code: Record<string, unknown>[] }) => {
      const protocolCode = protocol.code;
      if (!protocolCode) {
        return;
      }
      const result = await executeCommand(protocolCode);
      if (typeof result !== "object") {
        throw new Error("Invalid result");
      }
      return result;
    },
    onSuccess: (result) => {
      // Scan replies embed the battery level; patch the battery cache so
      // consumers stay fresh without re-firing the battery command.
      const pct = (result as { device_battery?: unknown } | undefined)?.device_battery;
      const device = client.getQueryData<Device[]>(connectionKeys.connectedDevices)?.[0];
      if (typeof pct === "number" && device) {
        client.setQueryData(connectionKeys.battery(device.id), pct);
      }
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
    progress,
    scanStartedAt,
    estimatedMs,
  };
}
