import { useQuery } from "@tanstack/react-query";
import { useConnectedDevice } from "~/features/connection/hooks/use-device-connection";
import { useScannerCommandExecutor } from "~/features/connection/hooks/use-scanner-command-executor";
import { connectionKeys } from "~/features/connection/services/connection-keys";

/**
 * Battery level of the connected MultispeQ. The react-query cache is the
 * single source — every consumer (header chip, Home device card, device
 * sheet) mounts this hook and shares one fetch per device.
 */
export function useBatteryLevel(): number | undefined {
  const { data: connectedDevice } = useConnectedDevice();
  const { executeCommand } = useScannerCommandExecutor();

  const { data } = useQuery({
    queryKey: connectionKeys.battery(connectedDevice?.id),
    queryFn: async () => {
      if (!connectedDevice) return null;
      const response = await executeCommand("battery");
      if (typeof response !== "string") return null;
      const pct = parseInt(response.replace("battery:", ""));
      if (isNaN(pct)) return null;
      return pct;
    },
    enabled: !!connectedDevice,
  });

  return data ?? undefined;
}
