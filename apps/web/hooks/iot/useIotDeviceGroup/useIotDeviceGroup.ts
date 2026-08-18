import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

export const useIotDeviceGroup = (groupId: string) => {
  return useQuery(orpc.deviceGroups.getDeviceGroup.queryOptions({ input: { groupId } }));
};
