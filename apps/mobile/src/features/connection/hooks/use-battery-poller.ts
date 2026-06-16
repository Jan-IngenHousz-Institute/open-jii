import { useQuery } from "@tanstack/react-query";
import { useConnectedDevice } from "~/features/connection/hooks/use-device-connection";
import { useDeviceConnectionStore } from "~/features/connection/hooks/use-device-connection-store";
import { useScannerCommandExecutor } from "~/features/connection/hooks/use-scanner-command-executor";

/**
 * `battery` is a trivial console command — a healthy device answers in well
 * under a second. Cap its wait far below the 60s protocol base timeout so an
 * unresponsive device can't hog the (serialized) command queue, which would
 * otherwise block a measurement queued behind it.
 */
const BATTERY_TIMEOUT_MS = 5_000;

/**
 * Polls the connected MultispeQ for its battery level on a slow cadence and
 * mirrors the value into the connection store so any consumer (header chip,
 * Home device card, Profile, etc.) can read it without re-firing the BLE
 * command.
 *
 * Battery and measurements share one serialized command queue. Polls run as
 * `background` commands (they don't flip `isExecuting`), so the `!isExecuting`
 * gate below reflects measurements only and pauses polling for their whole
 * duration — a battery refetch must never jump the queue ahead of, or stall, a
 * running measurement, nor reset its on-screen timer/estimate.
 */
export function useBatteryPoller() {
  const { data: connectedDevice } = useConnectedDevice();
  const setBatteryLevel = useDeviceConnectionStore((s) => s.setBatteryLevel);
  const { executeCommand, isExecuting } = useScannerCommandExecutor();

  return useQuery({
    queryKey: ["device", connectedDevice?.id, "battery"],
    queryFn: async () => {
      if (!connectedDevice) return null;
      const response = await executeCommand("battery", {
        timeoutMs: BATTERY_TIMEOUT_MS,
        background: true,
      });
      if (typeof response !== "string") return null;
      const pct = parseInt(response.replace("battery:", ""));
      if (isNaN(pct)) return null;
      setBatteryLevel(pct);
      return pct;
    },
    enabled: !!connectedDevice && !isExecuting,
  });
}
