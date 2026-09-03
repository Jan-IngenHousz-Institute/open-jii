import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

export const useIotDeviceGroups = () => {
  return useQuery(orpc.iot.listIotDeviceGroups.queryOptions());
};
