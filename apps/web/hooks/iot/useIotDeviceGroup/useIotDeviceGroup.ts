import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

export const useIotDeviceGroup = (groupId: string) => {
  return useQuery(orpc.iot.getIotDeviceGroup.queryOptions({ input: { groupId } }));
};
