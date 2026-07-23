import { useQuery } from "@tanstack/react-query";
import { useConnectedDevice } from "~/features/connection/hooks/use-device-connection";
import { useScannerCommandExecutor } from "~/features/connection/hooks/use-scanner-command-executor";
import { connectionKeys } from "~/features/connection/services/connection-keys";

// `battery` is a trivial console command; a healthy device answers in well
// under a second. Cap its wait far below the 60s protocol base timeout so an
// unresponsive device can't hog the (serialized) command queue and block a
// measurement queued behind it.
const BATTERY_TIMEOUT_MS = 5_000;

/**
 * Battery level reported by the primary connected device. The react-query cache is the single
 * source: every consumer (header chip, Home device card, device sheet) mounts
 * this hook and shares one fetch per device.
 *
 * Polls run as `background` commands (they don't flip `isExecuting`), so the
 * `!isExecuting` gate reflects measurements only and pauses polling for their
 * whole duration: a battery refetch must never jump the queue ahead of, or
 * stall, a running measurement.
 */
export function useBatteryLevel(): number | undefined {
  const { data: connectedDevice } = useConnectedDevice();
  const { executeCommand, isExecuting } = useScannerCommandExecutor();

  const { data } = useQuery({
    queryKey: connectionKeys.battery(connectedDevice?.id),
    queryFn: async () => {
      if (!connectedDevice) return null;
      const response = await executeCommand("battery", {
        timeoutMs: BATTERY_TIMEOUT_MS,
        background: true,
      });
      if (typeof response !== "string") return null;
      const pct = parseInt(response.replace("battery:", ""));
      if (isNaN(pct)) return null;
      return pct;
    },
    enabled: !!connectedDevice && !isExecuting,
  });

  return data ?? undefined;
}
