"use strict";

// Handler only: AWS I/O. Parsing and batching live in @repo/monitoring, whose
// compiled output is copied to ./lib at build time.
const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");
const { CloudWatchClient, PutMetricDataCommand } = require("@aws-sdk/client-cloudwatch");

// Imported directly rather than through the barrel: that would pull in the
// catalog module and its js-yaml dependency, which this function does not ship
const { batchByNamespace, parseObservations } = require("./lib/forwarder.js");

const s3 = new S3Client({});
const cloudwatch = new CloudWatchClient({});

// PutMetricData accepts 1000 datapoints per call; stay well under the 1MB request cap
const BATCH_SIZE = 100;

async function forwardObject(bucket, key) {
  const response = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const { observations, skipped } = parseObservations(await response.Body.transformToString());

  for (const batch of batchByNamespace(observations, BATCH_SIZE)) {
    await cloudwatch.send(
      new PutMetricDataCommand({ Namespace: batch.namespace, MetricData: batch.data }),
    );
  }

  return { published: observations.length, skipped: skipped.map((line) => ({ key, ...line })) };
}

exports.handler = async (event) => {
  let published = 0;
  const skipped = [];
  const failed = [];

  // One object failing (a replayed file older than CloudWatch's two-week backfill
  // window, a throttle) must not lose the others in the same event, and must leave
  // a log line naming it rather than aborting before the summary is written.
  for (const record of event.Records ?? []) {
    const bucket = record.s3.bucket.name;
    const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));

    try {
      const result = await forwardObject(bucket, key);
      published += result.published;
      skipped.push(...result.skipped);
    } catch (error) {
      failed.push({ key, message: error.message });
    }
  }

  console.log(JSON.stringify({ published, skipped, failed }));

  if (failed.length > 0) {
    throw new Error(`${failed.length} heartbeat object(s) failed to forward`);
  }
};
