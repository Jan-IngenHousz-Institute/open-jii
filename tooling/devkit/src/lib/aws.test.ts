import { CloudWatchClient, GetMetricStatisticsCommand } from "@aws-sdk/client-cloudwatch";
import { KinesisClient, PutRecordsCommand } from "@aws-sdk/client-kinesis";
import { GetObjectCommand, ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";
import { mockClient } from "aws-sdk-client-mock";
import { Readable } from "node:stream";
import { gzipSync } from "node:zlib";
import { afterEach, describe, expect, it } from "vitest";

import { createArchiveReader, createStreamReaders, createStreamWriter } from "./aws.js";

const s3 = mockClient(S3Client);
const kinesis = mockClient(KinesisClient);
const cloudwatch = mockClient(CloudWatchClient);

afterEach(() => {
  s3.reset();
  kinesis.reset();
  cloudwatch.reset();
});

/** An S3 object body as the SDK hands it back: a stream that can also read itself whole. */
function objectBody(bytes: Buffer) {
  return Object.assign(Readable.from([bytes]), {
    transformToString: () => Promise.resolve(bytes.toString("utf8")),
    transformToByteArray: () => Promise.resolve(new Uint8Array(bytes)),
    transformToWebStream: () => new ReadableStream(),
  });
}

describe("createArchiveReader", () => {
  const written = new Date("2026-10-07T12:00:00Z");
  const restoredUntil = new Date("2026-10-14T00:00:00Z");

  it("lists every page of a prefix, with the restore state of archived objects", async () => {
    s3.on(ListObjectsV2Command)
      .resolvesOnce({
        Contents: [
          { Key: "raw-iot/a.gz", LastModified: written },
          {
            Key: "raw-iot/b.gz",
            LastModified: written,
            StorageClass: "GLACIER",
            RestoreStatus: { IsRestoreInProgress: false, RestoreExpiryDate: restoredUntil },
          },
        ],
        NextContinuationToken: "page-2",
      })
      .resolvesOnce({
        Contents: [
          {
            Key: "raw-iot/c.gz",
            LastModified: written,
            StorageClass: "DEEP_ARCHIVE",
            RestoreStatus: { IsRestoreInProgress: true },
          },
        ],
      });

    const objects = await createArchiveReader("bucket", "openjii-dev").list("raw-iot/");

    expect(objects).toEqual([
      { key: "raw-iot/a.gz", lastModified: written, storageClass: "STANDARD", restoredUntil: null },
      { key: "raw-iot/b.gz", lastModified: written, storageClass: "GLACIER", restoredUntil },
      {
        key: "raw-iot/c.gz",
        lastModified: written,
        storageClass: "DEEP_ARCHIVE",
        restoredUntil: null,
      },
    ]);
    const calls = s3.commandCalls(ListObjectsV2Command).map((call) => call.args[0].input);
    expect(calls[1]).toEqual({
      Bucket: "bucket",
      Prefix: "raw-iot/",
      ContinuationToken: "page-2",
      OptionalObjectAttributes: ["RestoreStatus"],
    });
  });

  it("reads Firehose's gzipped objects and the error action's plain ones", async () => {
    s3.on(GetObjectCommand, { Key: "raw-iot/a.gz" })
      .resolves({ Body: objectBody(gzipSync(Buffer.from('{"a":1}\n{"a":2}'))) })
      .on(GetObjectCommand, { Key: "iot-rule-errors/b.json" })
      .resolves({ Body: objectBody(Buffer.from('{"b":1}')) });
    const reader = createArchiveReader("bucket", "openjii-dev");

    expect(await reader.read("raw-iot/a.gz")).toBe('{"a":1}\n{"a":2}');
    expect(await reader.read("iot-rule-errors/b.json")).toBe('{"b":1}');
  });
});

describe("createStreamWriter", () => {
  it("gives each record's outcome in the order the records were sent", async () => {
    kinesis.on(PutRecordsCommand).resolves({
      Records: [
        { SequenceNumber: "seq-1", ShardId: "shard-1" },
        { ErrorCode: "ProvisionedThroughputExceededException", ErrorMessage: "slow down" },
      ],
      FailedRecordCount: 1,
    });

    const results = await createStreamWriter("stream", "openjii-dev").put([
      { data: '{"a":1}', partitionKey: "replay/run/0" },
      { data: '{"a":2}', partitionKey: "replay/run/1" },
    ]);

    expect(results).toEqual([
      { sequenceNumber: "seq-1", error: null },
      { sequenceNumber: null, error: "ProvisionedThroughputExceededException: slow down" },
    ]);
    const [call] = kinesis.commandCalls(PutRecordsCommand);
    expect(call.args[0].input.StreamName).toBe("stream");
    expect(call.args[0].input.Records?.map((record) => record.PartitionKey)).toEqual([
      "replay/run/0",
      "replay/run/1",
    ]);
  });
});

describe("createStreamReaders", () => {
  const now = new Date("2026-10-07T14:00:00Z");

  it("takes how far the slowest reader had read from the latest minute's iterator age", async () => {
    cloudwatch.on(GetMetricStatisticsCommand).resolves({
      Datapoints: [
        { Timestamp: new Date("2026-10-07T13:57:00Z"), Maximum: 0 },
        { Timestamp: new Date("2026-10-07T13:58:00Z"), Maximum: 90_000 },
        { Timestamp: new Date("2026-10-07T13:56:00Z"), Maximum: 0 },
      ],
    });

    const readUpTo = await createStreamReaders("stream", "openjii-dev").readUpTo(now);

    expect(readUpTo).toEqual(new Date("2026-10-07T13:56:30Z"));
    const [call] = cloudwatch.commandCalls(GetMetricStatisticsCommand);
    expect(call.args[0].input.MetricName).toBe("GetRecords.IteratorAgeMilliseconds");
    expect(call.args[0].input.Dimensions).toEqual([{ Name: "StreamName", Value: "stream" }]);
    expect(call.args[0].input.StartTime).toEqual(new Date("2026-10-07T13:50:00Z"));
    expect(call.args[0].input.Statistics).toEqual(["Maximum"]);
  });

  it("says nothing read the stream when the metric has no datapoints", async () => {
    cloudwatch.on(GetMetricStatisticsCommand).resolves({ Datapoints: [] });

    expect(await createStreamReaders("stream", "openjii-dev").readUpTo(now)).toBeNull();
  });
});
