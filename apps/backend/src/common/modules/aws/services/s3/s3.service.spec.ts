import { GetObjectCommand, NoSuchKey, S3Client } from "@aws-sdk/client-s3";
import type { PutObjectCommand } from "@aws-sdk/client-s3";
import { Test } from "@nestjs/testing";
import { mockClient } from "aws-sdk-client-mock";
import { Readable } from "stream";

import { assertFailure, assertSuccess } from "../../../../utils/fp-utils";
import { AwsConfigService } from "../config/config.service";
import { AwsS3Service } from "./s3.service";

const s3Mock = mockClient(S3Client);

const exportsConfig = {
  region: "eu-central-1",
  s3Config: {
    iotArchiveBucketName: "test-iot-archive-bucket",
    largeIotBucketName: "test-large-iot-bucket",
    dataExportsBucketName: "test-data-exports-bucket",
  },
};

/** Records what it was asked to sign instead of signing, which needs credentials. */
class RecordingSignerS3Service extends AwsS3Service {
  readonly signed: GetObjectCommand[] = [];

  protected override createSignedUrl(command: PutObjectCommand | GetObjectCommand) {
    if (command instanceof GetObjectCommand) {
      this.signed.push(command);
    }
    return Promise.resolve("https://test-data-exports-bucket.s3.test/signed");
  }
}

/** An S3 object body as the SDK hands it back: a stream that can also read itself whole. */
function objectBody(text: string) {
  const bytes = Buffer.from(text);
  return Object.assign(Readable.from([bytes]), {
    transformToString: () => Promise.resolve(text),
    transformToByteArray: () => Promise.resolve(new Uint8Array(bytes)),
    transformToWebStream: () => new ReadableStream(),
  });
}

async function exportsService(): Promise<RecordingSignerS3Service> {
  const module = await Test.createTestingModule({
    providers: [RecordingSignerS3Service, { provide: AwsConfigService, useValue: exportsConfig }],
  }).compile();
  return module.get(RecordingSignerS3Service);
}

describe("AwsS3Service", () => {
  let service: AwsS3Service;

  const mockAwsConfig = {
    region: "eu-central-1",
    s3Config: {
      iotArchiveBucketName: "test-iot-archive-bucket",
      largeIotBucketName: "test-large-iot-bucket",
    },
  } as unknown as AwsConfigService;

  beforeEach(() => {
    service = new AwsS3Service(mockAwsConfig);
  });

  describe("getIotUploadUrl", () => {
    it("returns a presigned upload URL with key and expiry", async () => {
      const mockUrl = "https://s3.amazonaws.com/bucket/large-iot/exp-123/uuid.json?signed=1";
      vi.spyOn(service as any, "createSignedUrl").mockResolvedValue(mockUrl);

      const result = await service.getIotUploadUrl("exp-123");

      assertSuccess(result);
      expect(result.value.uploadUrl).toBe(mockUrl);
      expect(result.value.key).toMatch(/^large-iot\/exp-123\/.+\.json$/);
      expect(result.value.expiresAt).toBeInstanceOf(Date);
      expect(result.value.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it("passes correct bucket, key prefix, and content type to PutObjectCommand", async () => {
      const spy = vi.spyOn(service as any, "createSignedUrl").mockResolvedValue("https://mock-url");

      await service.getIotUploadUrl("experiment-abc");

      const [command] = spy.mock.calls[0] as [PutObjectCommand];
      expect(command.input.Bucket).toBe("test-large-iot-bucket");
      expect(command.input.Key).toMatch(/^large-iot\/experiment-abc\/.+\.json$/);
      expect(command.input.ContentType).toBe("application/json");
    });

    it("returns failure with AWS_S3_PRESIGN_FAILED when createSignedUrl throws", async () => {
      vi.spyOn(service as any, "createSignedUrl").mockRejectedValue(
        new Error("Credentials expired"),
      );

      const result = await service.getIotUploadUrl("exp-123");

      assertFailure(result);
      expect(result.error.message).toBe("Credentials expired");
      expect(result.error.code).toBe("AWS_S3_PRESIGN_FAILED");
    });

    it("wraps non-Error throws into a failure with AWS_S3_PRESIGN_FAILED", async () => {
      vi.spyOn(service as any, "createSignedUrl").mockRejectedValue("something unexpected");

      const result = await service.getIotUploadUrl("exp-123");

      assertFailure(result);
      expect(result.error.message).toBe("Unknown error");
      expect(result.error.code).toBe("AWS_S3_PRESIGN_FAILED");
    });
  });
});

describe("AwsS3Service export objects", () => {
  beforeEach(() => {
    s3Mock.reset();
  });

  describe("getExportDownloadUrl", () => {
    it("signs a download of the export file under the name the browser saves it as", async () => {
      const service = await exportsService();

      const result = await service.getExportDownloadUrl(
        "exports/e/raw_data/csv/x/part-00000.csv.gz",
        "trial_raw-data_20261019_133841_part-1-of-2.csv.gz",
      );

      assertSuccess(result);
      expect(result.value.url).toBe("https://test-data-exports-bucket.s3.test/signed");
      expect(result.value.expiresAt.getTime()).toBeGreaterThan(Date.now());
      expect(service.signed.map((command) => command.input)).toEqual([
        {
          Bucket: "test-data-exports-bucket",
          Key: "exports/e/raw_data/csv/x/part-00000.csv.gz",
          ResponseContentDisposition:
            'attachment; filename="trial_raw-data_20261019_133841_part-1-of-2.csv.gz"',
        },
      ]);
    });
  });

  describe("readExportObject", () => {
    it("returns the object's text", async () => {
      s3Mock.on(GetObjectCommand).resolves({ Body: objectBody('{"rowCount": 3}') });
      const service = await exportsService();

      const result = await service.readExportObject("exports/e/raw_data/csv/x/manifest.json");

      assertSuccess(result);
      expect(result.value).toBe('{"rowCount": 3}');
      expect(s3Mock.commandCalls(GetObjectCommand)[0].args[0].input).toEqual({
        Bucket: "test-data-exports-bucket",
        Key: "exports/e/raw_data/csv/x/manifest.json",
      });
    });

    it("returns null for an object that was never written", async () => {
      s3Mock
        .on(GetObjectCommand)
        .rejects(new NoSuchKey({ message: "The specified key does not exist.", $metadata: {} }));
      const service = await exportsService();

      const result = await service.readExportObject("exports/e/raw_data/csv/x/manifest.json");

      assertSuccess(result);
      expect(result.value).toBeNull();
    });

    it("fails with AWS_S3_READ_FAILED when the bucket refuses the read", async () => {
      s3Mock.on(GetObjectCommand).rejects(new Error("Access Denied"));
      const service = await exportsService();

      const result = await service.readExportObject("exports/e/raw_data/csv/x/manifest.json");

      assertFailure(result);
      expect(result.error.code).toBe("AWS_S3_READ_FAILED");
      expect(result.error.message).toBe("Access Denied");
    });
  });
});
