import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

/** Every calibration run recorded for a device, newest first. */
export const useDeviceCalibrationRuns = (deviceId: string, options?: { enabled?: boolean }) =>
  useQuery(
    orpc.iot.listDeviceCalibrationRuns.queryOptions({
      input: { deviceId },
      enabled: options?.enabled ?? true,
    }),
  );
