import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { connectionKeys } from "~/features/connection/services/connection-keys";
import { executeScanAssignments } from "~/features/connection/services/scan-manager/execute-scan-assignments";
import type {
  MultiScanRound,
  ScanAssignment,
} from "~/features/connection/services/scan-manager/execute-scan-assignments";
import type { DeviceScanFailure } from "~/features/connection/services/scan-manager/utils/partition-scan-outcomes";
import { useScannerCommandExecutorStore } from "~/features/connection/stores/use-scanner-command-executor-store";
import type { Device } from "~/shared/types/device";

import type { DeviceIdentity } from "@repo/iot";

export type DeviceScanStatus = "idle" | "scanning" | "done" | "error";

export interface DeviceScanState {
  device: Device;
  identity?: DeviceIdentity;
  status: DeviceScanStatus;
  error?: Error;
}

export type { MultiScanRound, ScanAssignment };

/**
 * Multi-scan (see CONTEXT.md): run each assignment's command on its device in
 * parallel (the broadcast form assigns one protocol to every device).
 * Per-device outcomes; one failing device doesn't block the others. The round
 * always resolves; failures are data, not exceptions, so the caller keeps
 * successes accumulated across retry rounds and decides between
 * continue-with-successful and retry-failed.
 */
export function useMultiScanner() {
  const executors = useScannerCommandExecutorStore((s) => s.executors);
  const client = useQueryClient();

  const mutation = useMutation({
    networkMode: "always",
    mutationFn: async ({
      assignments,
      prefailed = [],
    }: {
      assignments: ScanAssignment[];
      /** Entries that failed before reaching the device (e.g. unresolvable payload). */
      prefailed?: DeviceScanFailure[];
    }): Promise<MultiScanRound> => {
      const round = await executeScanAssignments(assignments, {
        prefailed,
        executeCommandOn: useScannerCommandExecutorStore.getState().executeCommandOn,
      });

      // Scan replies embed the battery level; patch each device's battery
      // cache so consumers stay fresh without re-firing the battery command.
      for (const success of round.successes) {
        const pct = (success.result as { device_battery?: unknown } | undefined)?.device_battery;
        if (typeof pct === "number") {
          client.setQueryData(connectionKeys.battery(success.device.id), pct);
        }
      }

      return round;
    },
  });

  const deviceStates = useMemo<DeviceScanState[]>(
    () =>
      Array.from(executors.values(), (entry) => ({
        device: entry.device,
        identity: entry.identity,
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
      mutation.mutateAsync({
        assignments: protocol.code
          ? devices.map((device) => ({ device, command: protocol.code }))
          : [],
      }),
    // Dispatch rounds: each device runs its own payload; pre-resolved
    // failures ride along so one bad target doesn't sink the round.
    executeScanAssignments: (assignments: ScanAssignment[], prefailed?: DeviceScanFailure[]) =>
      mutation.mutateAsync({ assignments, prefailed }),
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
