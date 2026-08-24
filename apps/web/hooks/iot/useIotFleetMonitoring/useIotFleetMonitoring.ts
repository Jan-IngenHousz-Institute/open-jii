import type { MonitoringRange } from "@/components/iot-devices/monitoring/monitoring-range";
import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

/**
 * The fleet dashboard's warehouse facts for one window. No `placeholderData`,
 * same as the device and group hooks: axes derive from the selected range, so
 * a stale window against a new axis would render buckets that never lined up.
 */
export const useIotFleetMonitoring = (range: MonitoringRange, options?: { enabled?: boolean }) => {
  return useQuery(
    orpc.iot.getIotFleetMonitoring.queryOptions({
      input: { from: range.from, to: range.to, bucket: range.bucket },
      enabled: options?.enabled ?? true,
    }),
  );
};
