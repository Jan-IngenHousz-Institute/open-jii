import type { MonitoringRange } from "@/components/iot-devices/monitoring/monitoring-range";
import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

/**
 * The dashboard's warehouse-backed data for one window. Deliberately without
 * `placeholderData`: every panel derives axes and slices from the selected
 * range, so showing the previous window's response against the new range would
 * render sessions and buckets that never lined up. A range change loads.
 */
export const useDeviceMonitoring = (deviceId: string, range: MonitoringRange) => {
  return useQuery(
    orpc.iot.getDeviceMonitoring.queryOptions({
      input: { deviceId, from: range.from, to: range.to, bucket: range.bucket },
    }),
  );
};
