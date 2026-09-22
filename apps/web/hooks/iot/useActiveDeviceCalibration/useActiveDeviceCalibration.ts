import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

/** Null until a bench has worked out which device the unit on the port is. */
export const useActiveDeviceCalibration = (
  deviceId: string | null,
  options?: { enabled?: boolean },
) =>
  useQuery(
    orpc.iot.getActiveDeviceCalibration.queryOptions({
      input: { deviceId: deviceId ?? "" },
      enabled: (options?.enabled ?? true) && deviceId !== null,
    }),
  );
