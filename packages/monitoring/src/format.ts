/**
 * How a number reaches a human.
 *
 * CloudWatch hands back a bare float, so without the catalog's unit an iterator age of
 * 8797000 renders as "8.8M" and means nothing. Every signal that is not a plain count
 * declares its unit and gets read back in the terms someone would actually say.
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

function duration(milliseconds: number): string {
  const ms = Math.abs(milliseconds);

  if (ms < 1000) {
    return `${Math.round(ms)}ms`;
  }
  if (ms < MINUTE) {
    return `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)}s`;
  }
  if (ms < HOUR) {
    return `${Math.round(ms / MINUTE)}m`;
  }
  if (ms < DAY) {
    const hours = Math.floor(ms / HOUR);
    const minutes = Math.round((ms % HOUR) / MINUTE);
    return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
  }

  const days = Math.floor(ms / DAY);
  const hours = Math.round((ms % DAY) / HOUR);
  return hours === 0 ? `${days}d` : `${days}d ${hours}h`;
}

function bytes(value: number): string {
  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  let scaled = Math.abs(value);
  let step = 0;

  while (scaled >= 1024 && step < units.length - 1) {
    scaled /= 1024;
    step += 1;
  }

  return `${scaled.toFixed(scaled >= 100 || step === 0 ? 0 : 1)} ${units[step]}`;
}

function percent(value: number): string {
  // Sub-one-percent rates are the interesting ones for an error rate, so they keep
  // two decimals where a large percentage does not need them.
  const digits = Math.abs(value) < 1 ? 2 : Math.abs(value) < 10 ? 1 : 0;
  return `${value.toFixed(digits)}%`;
}

function count(value: number): string {
  if (Math.abs(value) >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (Math.abs(value) >= 1_000) {
    return `${(value / 1_000).toFixed(1)}k`;
  }
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

/** Units a signal may declare. Anything else, including nothing, reads as a count. */
export type MetricUnit = "milliseconds" | "seconds" | "minutes" | "bytes" | "percent";

export function formatValue(value: number, unit?: string): string {
  switch (unit) {
    case "milliseconds":
      return duration(value);
    case "seconds":
      return duration(value * 1000);
    case "minutes":
      return duration(value * MINUTE);
    case "bytes":
      return bytes(value);
    case "percent":
      return percent(value);
    default:
      return count(value);
  }
}
