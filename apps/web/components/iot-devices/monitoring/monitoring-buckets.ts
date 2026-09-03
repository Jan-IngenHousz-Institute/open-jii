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

// Hour buckets label an instant, so the viewer's zone is right. Day buckets
// are UTC days (date_trunc and the axis both use UTC midnights), so they are
// rendered in UTC; formatting those locally would shift every label a day back
// in negative-offset timezones.
export function formatBucketLabel(
  bucketStart: string,
  bucket: MonitoringBucket,
  locale: string,
): string {
  const at = new Date(bucketStart);

  if (bucket === "hour") {
    return at.toLocaleString(locale, {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return at.toLocaleDateString(locale, { day: "numeric", month: "short", timeZone: "UTC" });
}
