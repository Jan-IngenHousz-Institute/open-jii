import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

/**
 * Fetch the IoT devices owned by the authenticated user.
 */
export const useIotDevices = () => {
  return useQuery(orpc.iot.listIotDevices.queryOptions());
};
