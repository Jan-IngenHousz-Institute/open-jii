import type { ForwarderDatum, SkippedLine } from "./types.js";

/** Namespaces the forwarder role is allowed to publish into. */
export const ALLOWED_NAMESPACES = new Set(["OpenJII/Ingest", "OpenJII/Data", "OpenJII/Usage"]);

export interface ParseResult {
  observations: ForwarderDatum[];
  skipped: SkippedLine[];
}

/**
 * Parse the NDJSON heartbeat file. Lines carrying a "metric" key become
 * CloudWatch datapoints; "detail" roster lines are left in S3 for the digest
 * composer, which is what keeps per-experiment cardinality out of CloudWatch.
 */
export function parseObservations(body: string): ParseResult {
  const observations: ForwarderDatum[] = [];
  const skipped: SkippedLine[] = [];

  body.split("\n").forEach((rawLine, index) => {
    const line = rawLine.trim();
    if (line === "") {
      return;
    }

    const lineNumber = index + 1;
    let parsed: Record<string, unknown>;

    try {
      parsed = JSON.parse(line) as Record<string, unknown>;
    } catch {
      skipped.push({ line: lineNumber, reason: "invalid json" });
      return;
    }

    if (parsed.metric === undefined) {
      return;
    }

    const metric = parsed.metric;
    if (typeof metric !== "string" || metric === "") {
      skipped.push({ line: lineNumber, reason: "invalid metric name" });
      return;
    }

    const namespace = parsed.namespace;
    if (typeof namespace !== "string" || !ALLOWED_NAMESPACES.has(namespace)) {
      skipped.push({ line: lineNumber, reason: `namespace ${String(namespace)}` });
      return;
    }

    const timestamp = new Date(String(parsed.timestamp));
    if (Number.isNaN(timestamp.getTime())) {
      skipped.push({ line: lineNumber, reason: "invalid timestamp" });
      return;
    }

    const value = parsed.value;
    if (typeof value !== "number" || !Number.isFinite(value)) {
      skipped.push({ line: lineNumber, reason: "invalid value" });
      return;
    }

    const dimensions = (parsed.dimensions ?? {}) as Record<string, string | number>;

    observations.push({
      namespace,
      datum: {
        MetricName: metric,
        Value: value,
        Unit: typeof parsed.unit === "string" ? parsed.unit : "None",
        Timestamp: timestamp,
        Dimensions: Object.entries(dimensions).map(([name, dimensionValue]) => ({
          Name: name,
          Value: String(dimensionValue),
        })),
      },
    });
  });

  return { observations, skipped };
}

/** PutMetricData takes one namespace per call and caps datapoints per request. */
export function batchByNamespace(
  observations: ForwarderDatum[],
  batchSize: number,
): { namespace: string; data: ForwarderDatum["datum"][] }[] {
  const byNamespace = new Map<string, ForwarderDatum["datum"][]>();

  for (const { namespace, datum } of observations) {
    const bucket = byNamespace.get(namespace) ?? [];
    bucket.push(datum);
    byNamespace.set(namespace, bucket);
  }

  const batches: { namespace: string; data: ForwarderDatum["datum"][] }[] = [];
  for (const [namespace, data] of byNamespace) {
    for (let offset = 0; offset < data.length; offset += batchSize) {
      batches.push({ namespace, data: data.slice(offset, offset + batchSize) });
    }
  }

  return batches;
}
