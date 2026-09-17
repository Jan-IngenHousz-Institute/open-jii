import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

export const useActiveDeviceCalibration = (deviceId: string, options?: { enabled?: boolean }) =>
  useQuery(
    orpc.iot.getActiveDeviceCalibration.queryOptions({
      input: { deviceId },
      enabled: options?.enabled ?? true,
    }),
  );
