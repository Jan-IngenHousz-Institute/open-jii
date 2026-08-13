import type { MonitoringRangePreset } from "@/components/iot-devices/monitoring/monitoring-range";
import { resolveMonitoringRange } from "@/components/iot-devices/monitoring/monitoring-range";
import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

// The window is derived once per preset selection, not per render, so the
// query key stays stable between refetches.
export const useDeviceMonitoring = (deviceId: string, preset: MonitoringRangePreset) => {
  const range = useMemo(() => resolveMonitoringRange(preset), [preset]);

  return {
    ...useQuery(
      orpc.iot.getDeviceMonitoring.queryOptions({
        input: { deviceId, from: range.from, to: range.to, bucket: range.bucket },
        refetchInterval: 60_000,
      }),
    ),
    range,
  };
};
