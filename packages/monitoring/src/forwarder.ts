import type { ForwarderDatum, SkippedLine } from "./types.js";

/** Namespaces the forwarder role is allowed to publish into. */
export const ALLOWED_NAMESPACES = new Set(["OpenJII/Data", "OpenJII/Usage"]);

/**
 * PutMetricData rejects the whole request over one unrecognised unit, so a typo in a
 * single line would otherwise cost every datapoint batched with it.
 */
const CLOUDWATCH_UNITS = new Set([
  "Seconds",
  "Microseconds",
  "Milliseconds",
  "Bytes",
  "Kilobytes",
  "Megabytes",
  "Gigabytes",
  "Terabytes",
  "Bits",
  "Kilobits",
  "Megabits",
  "Gigabits",
  "Terabits",
  "Percent",
  "Count",
  "Bytes/Second",
  "Kilobytes/Second",
  "Megabytes/Second",
  "Gigabytes/Second",
  "Terabytes/Second",
  "Bits/Second",
  "Kilobits/Second",
  "Megabits/Second",
  "Gigabits/Second",
  "Terabits/Second",
  "Count/Second",
  "None",
]);

/** JSON.parse happily returns null, a number or an array; none of them has fields. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export interface ParseResult {
  observations: ForwarderDatum[];
  skipped: SkippedLine[];
}

/**
 * Parse the NDJSON heartbeat file. Lines carrying a "metric" key become CloudWatch
 * datapoints; "detail" roster lines stay in S3, which is what keeps per-experiment
 * cardinality out of CloudWatch. Their reader today is the openjii-triage skill and
 * whoever is holding an incident; the digest does not read them yet.
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
    let parsed: unknown;

    try {
      parsed = JSON.parse(line);
    } catch {
      skipped.push({ line: lineNumber, reason: "invalid json" });
      return;
    }

    // A bare `null` parses fine and then throws on the first field read, which would
    // abandon the rest of the file rather than costing this line.
    if (!isRecord(parsed)) {
      skipped.push({ line: lineNumber, reason: "not a json object" });
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

    const unit = parsed.unit ?? "None";
    if (typeof unit !== "string" || !CLOUDWATCH_UNITS.has(unit)) {
      skipped.push({ line: lineNumber, reason: `invalid unit ${String(parsed.unit)}` });
      return;
    }

    const dimensions = parsed.dimensions ?? {};
    if (!isRecord(dimensions)) {
      skipped.push({ line: lineNumber, reason: "invalid dimensions" });
      return;
    }

    observations.push({
      namespace,
      datum: {
        MetricName: metric,
        Value: value,
        Unit: unit,
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
