import { KinesisClient, PutRecordsCommand } from "@aws-sdk/client-kinesis";
import { GetObjectCommand, ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";
import { mockClient } from "aws-sdk-client-mock";
import { Agent } from "node:https";
import { Readable } from "node:stream";
import { gzipSync } from "node:zlib";
import { afterEach, describe, expect, it } from "vitest";

import { createArchiveReader, createStreamWriter, streamWriterConfig } from "./aws.js";

const s3 = mockClient(S3Client);
const kinesis = mockClient(KinesisClient);

afterEach(() => {
  s3.reset();
  kinesis.reset();
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

describe("streamWriterConfig", () => {
  it("never lets the SDK resend a request, and opens a connection per request", () => {
    const config = streamWriterConfig("openjii-dev");

    const handler = config.requestHandler;
    const agent = handler !== undefined && "httpsAgent" in handler ? handler.httpsAgent : undefined;

    expect(config.maxAttempts).toBe(1);
    expect(config.profile).toBe("openjii-dev");
    expect(agent instanceof Agent ? agent.options.keepAlive : undefined).toBe(false);
  });
});
