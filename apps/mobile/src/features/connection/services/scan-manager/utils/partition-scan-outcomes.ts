import type { DeviceCommandOutcome } from "~/features/connection/stores/use-scanner-command-executor-store";
import type { Device } from "~/shared/types/device";

export interface DeviceScanResult {
  device: Device;
  result: object;
}

export interface DeviceScanFailure {
  device: Device;
  error: Error;
}

export function partitionScanOutcomes(outcomes: DeviceCommandOutcome[]): {
  successes: DeviceScanResult[];
  failures: DeviceScanFailure[];
} {
  const successes: DeviceScanResult[] = [];
  const failures: DeviceScanFailure[] = [];

  for (const outcome of outcomes) {
    if (outcome.status === "rejected") {
      failures.push({ device: outcome.device, error: outcome.error });
    } else if (typeof outcome.result !== "object" || outcome.result === null) {
      // A bare-string reply is not a measurement (same rule as the
      // single-device scanner's "Invalid result" check).
      failures.push({ device: outcome.device, error: new Error("Invalid result") });
    } else {
      successes.push({ device: outcome.device, result: outcome.result });
    }
  }

  return { successes, failures };
}
