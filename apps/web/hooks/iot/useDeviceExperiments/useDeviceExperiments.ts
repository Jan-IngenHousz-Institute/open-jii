import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

/**
 * Fetch the experiments a device currently serves.
 */
export const useDeviceExperiments = (deviceId: string) => {
  return useQuery(orpc.iot.listDeviceExperiments.queryOptions({ input: { deviceId } }));
};
