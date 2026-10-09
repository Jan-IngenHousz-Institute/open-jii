import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

import { iotDeviceQuery } from "./iot-device-query";

/**
 * Fetch a single IoT device owned by the authenticated user. The monitoring
 * panel polls it for live connectivity via `refetchInterval`.
 */
export const useIotDevice = (deviceId: string, opts?: { refetchInterval?: number }) => {
  return useQuery(iotDeviceQuery(orpc, deviceId, opts));
};
