import type { MonitoringRange } from "@/components/iot-devices/monitoring/monitoring-range";
import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

/**
 * Reported firmware versions over a range. One warehouse scan, unlike the
 * monitoring dashboard's fan-out, so a caller that only needs the version does
 * not pay for sessions, throughput, battery and measurements too.
 */
export const useDeviceFirmwareHistory = (deviceId: string, range: MonitoringRange) =>
  useQuery(
    orpc.iot.getDeviceFirmwareHistory.queryOptions({
      input: { deviceId, from: range.from, to: range.to, bucket: range.bucket },
    }),
  );
