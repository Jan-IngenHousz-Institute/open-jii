import { tsr } from "@/lib/tsr";

/**
 * Fetch the IoT devices owned by the authenticated user.
 */
export const useIotDevices = () => {
  return tsr.iot.listIotDevices.useQuery({
    queryKey: ["devices"],
  });
};
