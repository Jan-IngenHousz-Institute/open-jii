import { MONITORING_MAX_SERIES } from "./monitoring-palette";

export interface ThroughputSeriesEntry {
  /** Stable series identity: an experiment id, a device id, or a sentinel. */
  key: string;
  bucketStart: string;
  count: number;
}

export interface ThroughputSeries {
  key: string;
  name: string;
  counts: number[];
}

interface SeriesGroup {
  name: string;
  keys: string[];
}

/**
 * Stacked-series folding shared by the device (per-experiment) and group
 * (per-member) throughput panels: fixed alphabetical order by display name,
 * zero-filled against the axis, and everything past the palette folded into
 * one "Other" group so series colors stay stable and CVD-safe.
 */
export function foldThroughputSeries(
  entries: ThroughputSeriesEntry[],
  axis: string[],
  nameFor: (key: string) => string,
  otherLabel: string,
): ThroughputSeries[] {
  const byKey = new Map<string, Map<string, number>>();
  for (const entry of entries) {
    const perBucket = byKey.get(entry.key) ?? new Map<string, number>();
    perBucket.set(entry.bucketStart, (perBucket.get(entry.bucketStart) ?? 0) + entry.count);
    byKey.set(entry.key, perBucket);
  }

  const orderedKeys = [...byKey.keys()].sort((a, b) => nameFor(a).localeCompare(nameFor(b)));

  const needsOtherGroup = orderedKeys.length > MONITORING_MAX_SERIES;
  const groups: SeriesGroup[] = needsOtherGroup
    ? [
        ...orderedKeys
          .slice(0, MONITORING_MAX_SERIES - 1)
          .map((key) => ({ name: nameFor(key), keys: [key] })),
        { name: otherLabel, keys: orderedKeys.slice(MONITORING_MAX_SERIES - 1) },
      ]
    : orderedKeys.map((key) => ({ name: nameFor(key), keys: [key] }));

  return groups.map(({ name, keys }) => ({
    key: keys.join("+"),
    name,
    counts: axis.map((bucketStart) =>
      keys.reduce((sum, key) => sum + (byKey.get(key)?.get(bucketStart) ?? 0), 0),
    ),
  }));
}
