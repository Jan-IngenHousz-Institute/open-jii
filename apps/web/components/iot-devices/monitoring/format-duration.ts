import { intervalToDuration } from "date-fns";

/** Compact, locale-neutral duration notation ("2d 4h", "3h 15m", "45m", "30s"). */
export function formatDurationShort(seconds: number): string {
  const duration = intervalToDuration({ start: 0, end: Math.round(seconds) * 1000 });
  const days = (duration.days ?? 0) + (duration.months ?? 0) * 30 + (duration.years ?? 0) * 365;

  if (days > 0) {
    return `${String(days)}d ${String(duration.hours ?? 0)}h`;
  }
  if ((duration.hours ?? 0) > 0) {
    return `${String(duration.hours ?? 0)}h ${String(duration.minutes ?? 0)}m`;
  }
  if ((duration.minutes ?? 0) > 0) {
    return `${String(duration.minutes ?? 0)}m`;
  }
  return `${String(duration.seconds ?? 0)}s`;
}
