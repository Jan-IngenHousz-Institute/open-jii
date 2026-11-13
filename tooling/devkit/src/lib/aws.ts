import { KinesisClient, PutRecordsCommand } from "@aws-sdk/client-kinesis";
import type { KinesisClientConfig } from "@aws-sdk/client-kinesis";
import { GetObjectCommand, ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";
import { Agent } from "node:https";
import { gunzipSync } from "node:zlib";

/** An object in a bucket, as a listing gives it. */
export interface ArchiveObject {
  key: string;
  lastModified: Date;
  storageClass: string;
  /** Until when a finished restore keeps an archived object readable, or null when none has. */
  restoredUntil: Date | null;
}

export interface ArchiveReader {
  list(prefix: string): Promise<ArchiveObject[]>;
  /** The object's text, unzipped when it was gzipped. */
  read(key: string): Promise<string>;
}

export interface StreamRecord {
  data: string;
  partitionKey: string;
}

/** One record's outcome, in the order the records were sent. */
export interface StreamResult {
  sequenceNumber: string | null;
  error: string | null;
}

export interface StreamWriter {
  put(records: StreamRecord[]): Promise<StreamResult[]>;
}

// The profile names an SSO session in ~/.aws/config, which also gives the region.
export function createArchiveReader(bucket: string, profile: string): ArchiveReader {
  const s3 = new S3Client({ profile });

  return {
    async list(prefix) {
      const objects: ArchiveObject[] = [];
      let token: string | undefined;
      do {
        // A restored object keeps its archive storage class; only its restore status says it is readable.
        const page = await s3.send(
          new ListObjectsV2Command({
            Bucket: bucket,
            Prefix: prefix,
            ContinuationToken: token,
            OptionalObjectAttributes: ["RestoreStatus"],
          }),
        );
        for (const item of page.Contents ?? []) {
          if (item.Key && item.LastModified) {
            const restore = item.RestoreStatus;
            objects.push({
              key: item.Key,
              lastModified: item.LastModified,
              storageClass: item.StorageClass ?? "STANDARD",
              restoredUntil:
                restore?.IsRestoreInProgress === false ? (restore.RestoreExpiryDate ?? null) : null,
            });
          }
        }
        token = page.NextContinuationToken;
      } while (token);
      return objects;
    },

    async read(key) {
      const object = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
      if (!object.Body) {
        throw new Error(`s3://${bucket}/${key} has no body`);
      }
      const bytes = Buffer.from(await object.Body.transformToByteArray());
      // Firehose gzips what it writes; the rule's error action writes plain JSON.
      const isGzip = bytes[0] === 0x1f && bytes[1] === 0x8b;
      return (isGzip ? gunzipSync(bytes) : bytes).toString("utf8");
    },
  };
}

/**
 * A resent PutRecords whose first try landed would copy every record in it, so the SDK never
 * retries, and the replay resends only the records Kinesis says it refused. Without the SDK's retry
 * a reused connection the server has closed would fail a batch, so each request opens its own.
 */
export function streamWriterConfig(profile: string): KinesisClientConfig {
  return {
    profile,
    maxAttempts: 1,
    requestHandler: { httpsAgent: new Agent({ keepAlive: false }) },
  };
}

export function createStreamWriter(streamName: string, profile: string): StreamWriter {
  const kinesis = new KinesisClient(streamWriterConfig(profile));

  return {
    async put(records) {
      const response = await kinesis.send(
        new PutRecordsCommand({
          StreamName: streamName,
          Records: records.map((record) => ({
            Data: Buffer.from(record.data),
            PartitionKey: record.partitionKey,
          })),
        }),
      );
      return (response.Records ?? []).map((result) => ({
        sequenceNumber: result.SequenceNumber ?? null,
        error: result.ErrorCode ? `${result.ErrorCode}: ${result.ErrorMessage ?? ""}` : null,
      }));
    },
  };
}
