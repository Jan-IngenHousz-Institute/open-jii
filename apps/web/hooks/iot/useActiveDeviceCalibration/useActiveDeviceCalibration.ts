import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

/** The calibration currently in force for a device, or null when it was never calibrated. */
export const useActiveDeviceCalibration = (deviceId: string, options?: { enabled?: boolean }) =>
  useQuery(
    orpc.iot.getActiveDeviceCalibration.queryOptions({
      input: { deviceId },
      enabled: options?.enabled ?? true,
    }),
  );
