import { tsr } from "@/lib/tsr";

/**
 * Fetch a single IoT device owned by the authenticated user.
 */
export const useIotDevice = (deviceId: string) => {
  return tsr.iot.getIotDevice.useQuery({
    queryData: { params: { deviceId } },
    queryKey: ["devices", deviceId],
  });
};
