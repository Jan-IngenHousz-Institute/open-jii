import { partitionScanOutcomes } from "~/features/connection/services/scan-manager/utils/partition-scan-outcomes";
import type {
  DeviceScanFailure,
  DeviceScanResult,
} from "~/features/connection/services/scan-manager/utils/partition-scan-outcomes";
import type { Device } from "~/shared/types/device";

export interface MultiScanRound {
  successes: DeviceScanResult[];
  failures: DeviceScanFailure[];
}

/** One device's payload for a scan round; devices without one sit the round out. */
export interface ScanAssignment {
  device: Device;
  command: string | object;
  /** Provenance of the payload (dispatch rounds), threaded to the upload. */
  protocolId?: string;
  protocolName?: string;
}

export interface ExecuteScanAssignmentsOptions {
  prefailed?: DeviceScanFailure[];
  timeoutMs?: number;
  executeCommandOn: (
    deviceId: string,
    command: string | object,
    options?: { timeoutMs?: number },
  ) => Promise<string | object>;
}

/**
 * Shared non-React assignment boundary used by both the legacy multi-scan hook
 * and the workbook runner port. Every device starts before any result is
 * awaited; failures remain per-device data.
 */
export async function executeScanAssignments(
  assignments: ScanAssignment[],
  options: ExecuteScanAssignmentsOptions,
): Promise<MultiScanRound> {
  const prefailed = options.prefailed ?? [];
  if (assignments.length === 0) return { successes: [], failures: [...prefailed] };

  const settled = await Promise.allSettled(
    assignments.map(({ device, command }) =>
      options.timeoutMs === undefined
        ? options.executeCommandOn(device.id, command)
        : options.executeCommandOn(device.id, command, { timeoutMs: options.timeoutMs }),
    ),
  );
  const outcomes = assignments.map(({ device }, index) => {
    const result = settled[index];
    return result.status === "fulfilled"
      ? ({ device, status: "fulfilled", result: result.value } as const)
      : {
          device,
          status: "rejected" as const,
          error: result.reason instanceof Error ? result.reason : new Error(String(result.reason)),
        };
  });
  const round = partitionScanOutcomes(outcomes);
  round.failures.push(...prefailed);
  return round;
}
