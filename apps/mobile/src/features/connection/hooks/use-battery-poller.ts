import { useQuery } from "@tanstack/react-query";
import { useConnectedDevice } from "~/features/connection/hooks/use-device-connection";
import { useDeviceConnectionStore } from "~/features/connection/hooks/use-device-connection-store";
import { useScannerCommandExecutor } from "~/features/connection/hooks/use-scanner-command-executor";

/**
 * Polls the connected MultispeQ for its battery level on a slow cadence and
 * mirrors the value into the connection store so any consumer (header chip,
 * Home device card, Profile, etc.) can read it without re-firing the BLE
 * command.
 */
export function useBatteryPoller() {
  const { data: connectedDevice } = useConnectedDevice();
  const setBatteryLevel = useDeviceConnectionStore((s) => s.setBatteryLevel);
  const { executeCommand } = useScannerCommandExecutor();

  return useQuery({
    queryKey: ["device", connectedDevice?.id, "battery"],
    queryFn: async () => {
      if (!connectedDevice) return null;
      const response = await executeCommand("battery");
      if (typeof response !== "string") return null;
      const pct = parseInt(response.replace("battery:", ""));
      if (isNaN(pct)) return null;
      setBatteryLevel(pct);
      return pct;
    },
    enabled: !!connectedDevice,
  });
}
