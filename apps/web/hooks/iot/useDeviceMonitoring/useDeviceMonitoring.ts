import type { MonitoringRange } from "@/components/iot-devices/monitoring/monitoring-range";
import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

/**
 * The dashboard's warehouse-backed data for one window. The caller owns the
 * range, so every panel reads the same one; previous data is kept while a new
 * range loads so the page updates in place instead of collapsing to skeletons.
 */
export const useDeviceMonitoring = (deviceId: string, range: MonitoringRange) => {
  return useQuery(
    orpc.iot.getDeviceMonitoring.queryOptions({
      input: { deviceId, from: range.from, to: range.to, bucket: range.bucket },
      placeholderData: (previous) => previous,
    }),
  );
};
