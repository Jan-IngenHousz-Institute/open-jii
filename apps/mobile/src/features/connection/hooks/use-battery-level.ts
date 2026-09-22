import { useQuery } from "@tanstack/react-query";
import { useConnectedDevice } from "~/features/connection/hooks/use-device-connection";
import { useScannerCommandExecutor } from "~/features/connection/hooks/use-scanner-command-executor";
import { connectionKeys } from "~/features/connection/services/connection-keys";
import { useScannerCommandExecutorStore } from "~/features/connection/stores/use-scanner-command-executor-store";

/**
 * Battery level reported by the primary connected device. The react-query cache is the single
 * source: every consumer (header chip, Home device card, device sheet) mounts
 * this hook and shares one fetch per device.
 *
 * Battery is read through the driver's own `getDeviceIdentity()` rather than a
 * raw console command: `battery` is MultispeQ console syntax, and an Ambit
 * rejects it outright. Each driver decides how to answer, and a family with no
 * battery reading simply reports none.
 *
 * Reads go straight to the executor, so they never flip the store's
 * `isExecuting`; the `!isExecuting` gate still pauses polling for a whole
 * measurement so a refetch cannot stall the serialized command queue.
 */
export function useBatteryLevel(): number | undefined {
  const { data: connectedDevice } = useConnectedDevice();
  const { isExecuting } = useScannerCommandExecutor();
  const executor = useScannerCommandExecutorStore((s) =>
    connectedDevice ? s.executors.get(connectedDevice.id)?.executor : undefined,
  );

  const { data } = useQuery({
    queryKey: connectionKeys.battery(connectedDevice?.id),
    queryFn: async () => {
      if (!executor) return null;
      const identity = await executor.getIdentity();
      return identity.batteryPercent ?? null;
    },
    enabled: !!connectedDevice && !!executor && !isExecuting,
  });

  return data ?? undefined;
}
