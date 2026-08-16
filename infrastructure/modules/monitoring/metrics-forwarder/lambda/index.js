"use strict";

const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");
const { CloudWatchClient, PutMetricDataCommand } = require("@aws-sdk/client-cloudwatch");

const s3 = new S3Client({});
const cloudwatch = new CloudWatchClient({});

// PutMetricData accepts 1000 datapoints per call; stay well under the 1MB request cap
const BATCH_SIZE = 100;
const ALLOWED_NAMESPACES = new Set(["OpenJII/Ingest", "OpenJII/Data", "OpenJII/Usage"]);

async function readObject(bucket, key) {
  const response = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  return response.Body.transformToString();
}

function parseObservations(body, key) {
  const observations = [];
  const skipped = [];

  for (const [lineNumber, line] of body.split("\n").entries()) {
    const trimmed = line.trim();
    if (trimmed === "") {
      continue;
    }

    let parsed;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      skipped.push({ key, line: lineNumber + 1, reason: "invalid json" });
      continue;
    }

    // Roster/detail lines exist for the digest composer to read straight from S3;
    // forwarding them would blow up CloudWatch metric cardinality
    if (parsed.metric === undefined) {
      continue;
    }

    if (!ALLOWED_NAMESPACES.has(parsed.namespace)) {
      skipped.push({ key, line: lineNumber + 1, reason: `namespace ${parsed.namespace}` });
      continue;
    }

    const timestamp = new Date(parsed.timestamp);
    if (Number.isNaN(timestamp.getTime())) {
      skipped.push({ key, line: lineNumber + 1, reason: "invalid timestamp" });
      continue;
    }

    if (typeof parsed.value !== "number" || !Number.isFinite(parsed.value)) {
      skipped.push({ key, line: lineNumber + 1, reason: "invalid value" });
      continue;
    }

    observations.push({
      namespace: parsed.namespace,
      datum: {
        MetricName: parsed.metric,
        Value: parsed.value,
        Unit: parsed.unit ?? "None",
        Timestamp: timestamp,
        Dimensions: Object.entries(parsed.dimensions ?? {}).map(([name, value]) => ({
          Name: name,
          Value: String(value),
        })),
      },
    });
  }

  return { observations, skipped };
}

async function publish(observations) {
  const byNamespace = new Map();
  for (const { namespace, datum } of observations) {
    const bucket = byNamespace.get(namespace) ?? [];
    bucket.push(datum);
    byNamespace.set(namespace, bucket);
  }

  for (const [namespace, data] of byNamespace) {
    for (let offset = 0; offset < data.length; offset += BATCH_SIZE) {
      await cloudwatch.send(
        new PutMetricDataCommand({
          Namespace: namespace,
          MetricData: data.slice(offset, offset + BATCH_SIZE),
        }),
      );
    }
  }
}

exports.handler = async (event) => {
  let published = 0;
  const skippedLines = [];

  for (const record of event.Records ?? []) {
    const bucket = record.s3.bucket.name;
    const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));

    const body = await readObject(bucket, key);
    const { observations, skipped } = parseObservations(body, key);

    await publish(observations);
    published += observations.length;
    skippedLines.push(...skipped);
  }

  console.log(JSON.stringify({ published, skipped: skippedLines }));
};
