import { format } from "date-fns";

import type { MonitoringBucket } from "@repo/api/domains/iot/iot.schema";

const BUCKET_MS: Record<MonitoringBucket, number> = {
  hour: 3_600_000,
  day: 86_400_000,
};

/**
 * The complete bucket axis for a range: zero-fill scaffolding so silent
 * periods render as visible gaps instead of a compressed axis.
 */
export function bucketAxis(from: string, to: string, bucket: MonitoringBucket): string[] {
  const step = BUCKET_MS[bucket];
  const start = Math.floor(new Date(from).getTime() / step) * step;
  const end = new Date(to).getTime();

  const axis: string[] = [];
  for (let at = start; at <= end; at += step) {
    axis.push(new Date(at).toISOString());
  }
  return axis;
}

export function formatBucketLabel(bucketStart: string, bucket: MonitoringBucket): string {
  return format(new Date(bucketStart), bucket === "hour" ? "MMM d HH:mm" : "MMM d");
}
