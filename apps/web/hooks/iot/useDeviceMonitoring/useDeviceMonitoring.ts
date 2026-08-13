import type { MonitoringRangePreset } from "@/components/iot-devices/monitoring/monitoring-range";
import { resolveMonitoringRange } from "@/components/iot-devices/monitoring/monitoring-range";
import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

const RANGE_REFRESH_MS = 60_000;

// The window re-anchors to now on the refresh cadence; a frozen anchor would
// quietly turn "last 24h" into "the 24h ending when the page was opened". Each
// re-anchor changes the query key, so previous data is held as placeholder to
// keep the panels from flashing back to skeletons.
export const useDeviceMonitoring = (deviceId: string, preset: MonitoringRangePreset) => {
  const [anchor, setAnchor] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => {
      setAnchor(Date.now());
    }, RANGE_REFRESH_MS);
    return () => {
      clearInterval(id);
    };
  }, []);

  const range = useMemo(() => resolveMonitoringRange(preset, anchor), [preset, anchor]);

  return {
    ...useQuery(
      orpc.iot.getDeviceMonitoring.queryOptions({
        input: { deviceId, from: range.from, to: range.to, bucket: range.bucket },
        placeholderData: (prev) => prev,
      }),
    ),
    range,
  };
};
