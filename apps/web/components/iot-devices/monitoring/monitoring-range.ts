import type { MonitoringBucket } from "@repo/api/domains/iot/iot.schema";

export type MonitoringRangePreset = "24h" | "7d" | "30d";

const RANGE_HOURS: Record<MonitoringRangePreset, number> = {
  "24h": 24,
  "7d": 24 * 7,
  "30d": 24 * 30,
};

/**
 * Resolve a range preset into the query window and its natural bucket:
 * hourly bars for a day, daily bars for longer ranges.
 */
export function resolveMonitoringRange(
  preset: MonitoringRangePreset,
  now = Date.now(),
): { from: string; to: string; bucket: MonitoringBucket } {
  return {
    from: new Date(now - RANGE_HOURS[preset] * 3_600_000).toISOString(),
    to: new Date(now).toISOString(),
    bucket: preset === "24h" ? "hour" : "day",
  };
}
