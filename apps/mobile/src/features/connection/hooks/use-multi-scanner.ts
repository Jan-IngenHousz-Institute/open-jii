import { useMutation } from "@tanstack/react-query";
import { useMemo } from "react";
import { useDeviceConnectionStore } from "~/features/connection/hooks/use-device-connection-store";
import { partitionScanOutcomes } from "~/features/connection/services/scan-manager/utils/partition-scan-outcomes";
import type {
  DeviceScanFailure,
  DeviceScanResult,
} from "~/features/connection/services/scan-manager/utils/partition-scan-outcomes";
import { useScannerCommandExecutorStore } from "~/features/connection/stores/use-scanner-command-executor-store";
import type { DeviceCommandOutcome } from "~/features/connection/stores/use-scanner-command-executor-store";
import type { Device } from "~/shared/types/device";

export type DeviceScanStatus = "idle" | "scanning" | "done" | "error";

export interface DeviceScanState {
  device: Device;
  status: DeviceScanStatus;
  error?: Error;
}

export interface MultiScanRound {
  successes: DeviceScanResult[];
  failures: DeviceScanFailure[];
}

/**
 * Multi-scan (see CONTEXT.md): run one protocol on the given devices in
 * parallel. Per-device outcomes — one failing sensor doesn't block the
 * others. The round always resolves; failures are data, not exceptions, so
 * the caller keeps successes accumulated across retry rounds and decides
 * between continue-with-successful and retry-failed.
 */
export function useMultiScanner() {
  const executors = useScannerCommandExecutorStore((s) => s.executors);
  const { setBatteryLevel } = useDeviceConnectionStore();

  const mutation = useMutation({
    networkMode: "always",
    mutationFn: async ({
      protocol,
      devices,
    }: {
      protocol: { code: Record<string, unknown>[] };
      devices: Device[];
    }): Promise<MultiScanRound> => {
      const protocolCode = protocol.code;
      if (!protocolCode || devices.length === 0) {
        return { successes: [], failures: [] };
      }

      const { executeCommandOn } = useScannerCommandExecutorStore.getState();
      const settled = await Promise.allSettled(
        devices.map((device) => executeCommandOn(device.id, protocolCode)),
      );
      const outcomes = devices.map((device, i): DeviceCommandOutcome => {
        const result = settled[i];
        return result.status === "fulfilled"
          ? { device, status: "fulfilled", result: result.value }
          : {
              device,
              status: "rejected",
              error:
                result.reason instanceof Error ? result.reason : new Error(String(result.reason)),
            };
      });

      const round = partitionScanOutcomes(outcomes);

      // Battery is tracked for the Primary device only (see CONTEXT.md).
      const primarySuccess = round.successes.find((s) => s.device.id === devices[0]?.id);
      if (primarySuccess) {
        setBatteryLevel((primarySuccess.result as any)?.device_battery);
      }

      return round;
    },
  });

  const deviceStates = useMemo<DeviceScanState[]>(
    () =>
      Array.from(executors.values(), (entry) => ({
        device: entry.device,
        status: entry.isExecuting
          ? "scanning"
          : entry.error
            ? "error"
            : entry.commandResponse
              ? "done"
              : "idle",
        error: entry.error,
      })),
    [executors],
  );

  return {
    executeScanAll: (protocol: { code: Record<string, unknown>[] }, devices: Device[]) =>
      mutation.mutateAsync({ protocol, devices }),
    deviceStates,
    isScanning: mutation.isPending,
    lastRound: mutation.data,
    reset: () => {
      mutation.reset();
      useScannerCommandExecutorStore.getState().reset();
    },
    cancelAll: () => useScannerCommandExecutorStore.getState().cancelAll(),
  };
}
