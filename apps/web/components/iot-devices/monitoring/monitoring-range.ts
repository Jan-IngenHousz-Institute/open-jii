import { differenceInHours, subDays, subHours } from "date-fns";

import type { MonitoringBucket } from "@repo/api/domains/iot/iot.schema";

export type MonitoringPresetId = "last1h" | "last24h" | "last7d" | "last30d";

export const MONITORING_PRESETS: MonitoringPresetId[] = ["last1h", "last24h", "last7d", "last30d"];

/** The contract caps a monitoring window; the picker refuses wider spans. */
export const MONITORING_MAX_RANGE_DAYS = 31;

// Hourly resolution stays readable up to a couple of days; beyond that the
// bucket count outgrows the axis and daily is the honest grain.
const HOURLY_BUCKET_MAX_HOURS = 48;

export interface MonitoringRange {
  from: string;
  to: string;
  bucket: MonitoringBucket;
}

export function resolveMonitoringPreset(
  preset: MonitoringPresetId,
  now = Date.now(),
): MonitoringRange {
  const to = new Date(now);
  const from = {
    last1h: () => subHours(to, 1),
    last24h: () => subHours(to, 24),
    last7d: () => subDays(to, 7),
    last30d: () => subDays(to, 30),
  }[preset]();

  return toMonitoringRange(from, to);
}

export function toMonitoringRange(from: Date, to: Date): MonitoringRange {
  return {
    from: from.toISOString(),
    to: to.toISOString(),
    bucket: differenceInHours(to, from) <= HOURLY_BUCKET_MAX_HOURS ? "hour" : "day",
  };
}

export function isRangeWithinLimit(from: Date, to: Date): boolean {
  return from < to && differenceInHours(to, from) <= MONITORING_MAX_RANGE_DAYS * 24;
}

/**
 * Turn a calendar selection into a window. The picker hands back midnights, so
 * the closing day is extended to cover itself. Incomplete or over-long
 * selections resolve to null: the contract rejects them, and silently
 * truncating the user's choice would be worse than ignoring it.
 */
export function rangeFromCalendarSelection(
  selected: { from?: Date; to?: Date } | undefined,
): MonitoringRange | null {
  if (!selected?.from || !selected.to) {
    return null;
  }

  const to = new Date(selected.to);
  to.setHours(23, 59, 59, 999);

  return isRangeWithinLimit(selected.from, to) ? toMonitoringRange(selected.from, to) : null;
}
