import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

import { iotDeviceGroupQuery } from "./iot-device-group-query";

export const useIotDeviceGroup = (groupId: string) => {
  return useQuery(iotDeviceGroupQuery(orpc, groupId));
};
