import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

import { iotDeviceGroupsQuery } from "./iot-device-groups-query";

export const useIotDeviceGroups = () => {
  return useQuery(iotDeviceGroupsQuery(orpc));
};
