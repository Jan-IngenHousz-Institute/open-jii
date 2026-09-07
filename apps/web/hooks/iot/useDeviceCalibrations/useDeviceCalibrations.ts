import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

/** A device's calibration history, superseded rows included, newest first. */
export const useDeviceCalibrations = (deviceId: string, options?: { enabled?: boolean }) =>
  useQuery(
    orpc.iot.listDeviceCalibrations.queryOptions({
      input: { deviceId },
      enabled: options?.enabled ?? true,
    }),
  );
