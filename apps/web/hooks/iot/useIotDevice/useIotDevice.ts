import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

/**
 * Fetch a single IoT device owned by the authenticated user.
 */
export const useIotDevice = (deviceId: string) => {
  return useQuery(orpc.iot.getIotDevice.queryOptions({ input: { deviceId } }));
};
