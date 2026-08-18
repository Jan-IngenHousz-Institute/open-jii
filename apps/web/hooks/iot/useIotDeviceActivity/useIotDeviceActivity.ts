import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

/**
 * Pipeline-computed last data arrival for a device. Every refetch is a
 * warehouse query and the value only moves per pipeline run, so it polls on
 * the dashboard cadence, not the live-tile one.
 */
export const useIotDeviceActivity = (deviceId: string) => {
  return useQuery(
    orpc.iot.getIotDeviceActivity.queryOptions({
      input: { deviceId },
      refetchInterval: 60_000,
    }),
  );
};
