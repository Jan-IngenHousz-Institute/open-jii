import type { ObservedExperiment } from "../domains/iot/iot.schema";

interface ThroughputLikeRow {
  bucketStart: string | null;
  experimentId: string | null;
  count: number;
}

/**
 * The one fold from throughput buckets to "which experiments did this device
 * feed": totals per claimed experiment, newest bucket as recency, busiest
 * first. The backend's observed-experiments endpoint and the lineage builder
 * both read arrivals this way, so the two surfaces can never disagree on what
 * the same rows mean. A null experimentId is a real bucket (rows the pipeline
 * could not attribute), kept rather than dropped.
 */
export function foldObservedExperiments(rows: ThroughputLikeRow[]): ObservedExperiment[] {
  const byExperiment = new Map<string | null, { count: number; lastAt: string | null }>();

  for (const row of rows) {
    const entry = byExperiment.get(row.experimentId) ?? { count: 0, lastAt: null };
    entry.count += row.count;
    if (row.bucketStart !== null && (entry.lastAt === null || row.bucketStart > entry.lastAt)) {
      entry.lastAt = row.bucketStart;
    }
    byExperiment.set(row.experimentId, entry);
  }

  return [...byExperiment.entries()]
    .map(([experimentId, entry]) => ({ experimentId, ...entry }))
    .sort((a, b) => b.count - a.count);
}
