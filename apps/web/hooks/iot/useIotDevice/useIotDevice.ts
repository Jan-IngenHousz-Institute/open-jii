import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

/**
 * Fetch a single IoT device owned by the authenticated user. The monitoring
 * panel polls it for live connectivity via `refetchInterval`.
 */
export const useIotDevice = (deviceId: string, opts?: { refetchInterval?: number }) => {
  return useQuery(
    orpc.iot.getIotDevice.queryOptions({
      input: { deviceId },
      refetchInterval: opts?.refetchInterval,
    }),
  );
};
