import { tsr } from "@/lib/tsr";

/**
 * Fetch the experiments a device currently serves.
 */
export const useDeviceExperiments = (deviceId: string) => {
  return tsr.iot.listDeviceExperiments.useQuery({
    queryData: { params: { deviceId } },
    queryKey: ["device-experiments", deviceId],
  });
};
