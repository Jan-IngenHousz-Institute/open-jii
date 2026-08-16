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

exports.handler = async (event) => {
  let published = 0;
  const skipped = [];

  for (const record of event.Records ?? []) {
    const bucket = record.s3.bucket.name;
    const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));

    const response = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    const { observations, skipped: skippedLines } = parseObservations(
      await response.Body.transformToString(),
    );

    for (const batch of batchByNamespace(observations, BATCH_SIZE)) {
      await cloudwatch.send(
        new PutMetricDataCommand({ Namespace: batch.namespace, MetricData: batch.data }),
      );
    }

    published += observations.length;
    skipped.push(...skippedLines.map((line) => ({ key, ...line })));
  }

  console.log(JSON.stringify({ published, skipped }));
};
