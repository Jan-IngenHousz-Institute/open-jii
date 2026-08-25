import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

/**
 * Fetch the IoT devices owned by the authenticated user. `enabled` lets a
 * surface outside the registry (the runner's register stitch) hold the request
 * until it actually has a device in hand.
 */
export const useIotDevices = (options?: { enabled?: boolean }) => {
  return useQuery(orpc.iot.listIotDevices.queryOptions({ enabled: options?.enabled ?? true }));
};
