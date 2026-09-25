import { useIsIdle } from "@/hooks/useIsIdle";
import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

/**
 * Pipeline-computed last data arrival for a device. Every refetch is a
 * warehouse query and the value only moves per pipeline run, so it polls on
 * the dashboard cadence, not the live-tile one, and not at all on a page left
 * unattended; the next input refetches it at once.
 */
export const useIotDeviceActivity = (deviceId: string) => {
  const isIdle = useIsIdle();

  return useQuery(
    orpc.iot.getIotDeviceActivity.queryOptions({
      input: { deviceId },
      enabled: !isIdle,
      refetchInterval: 60_000,
    }),
  );
};
