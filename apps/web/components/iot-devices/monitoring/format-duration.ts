const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3_600;
const SECONDS_PER_DAY = 86_400;

/**
 * Compact, locale-neutral duration notation ("2d 4h", "3h 15m", "45m", "30s").
 * Elapsed time is counted, not walked as a calendar: calendar units would fold
 * a span into months and years of unequal length and lose whole days on the
 * way back out.
 */
export function formatDurationShort(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));

  const days = Math.floor(total / SECONDS_PER_DAY);
  if (days > 0) {
    return `${String(days)}d ${String(Math.floor((total % SECONDS_PER_DAY) / SECONDS_PER_HOUR))}h`;
  }

  const hours = Math.floor(total / SECONDS_PER_HOUR);
  if (hours > 0) {
    return `${String(hours)}h ${String(Math.floor((total % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE))}m`;
  }

  const minutes = Math.floor(total / SECONDS_PER_MINUTE);
  if (minutes > 0) {
    return `${String(minutes)}m`;
  }

  return `${String(total)}s`;
}
