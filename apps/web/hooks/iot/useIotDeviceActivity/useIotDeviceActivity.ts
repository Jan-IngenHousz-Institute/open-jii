import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

/**
 * Pipeline-computed last data arrival for a device. Refreshed on the export
 * polling cadence; the value itself only moves when the pipeline runs.
 */
export const useIotDeviceActivity = (deviceId: string) => {
  return useQuery(
    orpc.iot.getIotDeviceActivity.queryOptions({
      input: { deviceId },
      refetchInterval: 15_000,
    }),
  );
};
