import type { MonitoringRange } from "@/components/iot-devices/monitoring/monitoring-range";
import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

/**
 * The group dashboard's data for one window. No `placeholderData`, same as the
 * device hook: axes derive from the selected range, so a stale window against
 * a new axis would render buckets that never lined up.
 */
export const useIotDeviceGroupMonitoring = (groupId: string, range: MonitoringRange) => {
  return useQuery(
    orpc.iot.getIotDeviceGroupMonitoring.queryOptions({
      input: { groupId, from: range.from, to: range.to, bucket: range.bucket },
    }),
  );
};
