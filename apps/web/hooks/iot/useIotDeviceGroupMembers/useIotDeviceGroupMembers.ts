import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

export const useIotDeviceGroupMembers = (groupId: string) => {
  return useQuery(orpc.iot.listIotDeviceGroupMembers.queryOptions({ input: { groupId } }));
};
