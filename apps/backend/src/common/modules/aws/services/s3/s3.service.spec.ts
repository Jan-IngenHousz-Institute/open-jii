import { GetObjectCommand, NoSuchKey, S3Client } from "@aws-sdk/client-s3";
import type { PutObjectCommand } from "@aws-sdk/client-s3";
import { Test } from "@nestjs/testing";
import { mockClient } from "aws-sdk-client-mock";
import { Readable } from "stream";

import { assertFailure, assertSuccess } from "../../../../utils/fp-utils";
import { AwsConfigService } from "../config/config.service";
import { AwsS3Service } from "./s3.service";
import type { GuestUploadOptions } from "./s3.types";

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
  readonly signed: { command: GetObjectCommand; expiresIn: number | undefined }[] = [];
  credentialsExpiry: Date | undefined = undefined;

  protected override createSignedUrl(
    command: PutObjectCommand | GetObjectCommand,
    expiresIn?: number,
  ) {
    if (command instanceof GetObjectCommand) {
      this.signed.push({ command, expiresIn });
    }
    return Promise.resolve("https://test-data-exports-bucket.s3.test/signed");
  }

  protected override signingCredentialsExpiry() {
    return Promise.resolve(this.credentialsExpiry);
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

  it("signs the exact guest key, UTF-8 size and JSON content type with the real SDK", async () => {
    vi.stubEnv("AWS_ACCESS_KEY_ID", "synthetic-access-key");
    vi.stubEnv("AWS_SECRET_ACCESS_KEY", "synthetic-secret-key");
    class CapturingSigner extends AwsS3Service {
      command?: PutObjectCommand;
      protected override createSignedUrl(command: PutObjectCommand, guest?: GuestUploadOptions) {
        this.command = command;
        return super.createSignedUrl(command, guest);
      }
    }
    try {
      const signer = new CapturingSigner(mockAwsConfig);
      const id = "94D8B584-2D27-46FA-AA6C-8908CE13D521";
      const size = Buffer.byteLength(JSON.stringify({ value: "é🌱" }), "utf8");
      const result = await signer.getIotUploadUrl(id, { guestContentLength: size });
      assertSuccess(result);
      expect(result.value.key).toMatch(
        /^large-iot\/94d8b584-2d27-46fa-aa6c-8908ce13d521\/guest\/[0-9a-f-]{36}\.json$/,
      );
      expect(signer.command?.input).toMatchObject({
        Key: result.value.key,
        ContentType: "application/json",
        ContentLength: size,
      });
      const url = new URL(result.value.uploadUrl);
      expect(url.searchParams.get("X-Amz-Expires")).toBe("900");
      expect(url.searchParams.has("x-amz-checksum-crc32")).toBe(false);
      expect(url.searchParams.get("X-Amz-SignedHeaders")?.split(";")).toEqual(
        expect.arrayContaining(["content-length", "content-type"]),
      );
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it.each([0, -1, 1.5, 1_048_577, NaN])(
    "refuses guest size %s before signing",
    async (guestContentLength) => {
      const result = await service.getIotUploadUrl("94d8b584-2d27-46fa-aa6c-8908ce13d521", {
        guestContentLength,
      });
      assertFailure(result);
      expect(result.error.code).toBe("GUEST_UPLOAD_SIZE_INVALID");
    },
  );

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
      expect(result.value.expiresAt.getTime()).toBeGreaterThan(Date.now() + 59 * 60_000);
      expect(service.signed.map(({ command }) => command.input)).toEqual([
        {
          Bucket: "test-data-exports-bucket",
          Key: "exports/e/raw_data/csv/x/part-00000.csv.gz",
          ResponseContentDisposition:
            'attachment; filename="trial_raw-data_20261019_133841_part-1-of-2.csv.gz"',
        },
      ]);
      expect(service.signed[0].expiresIn).toBe(3600);
    });

    it("reports when the signing credentials expire if that comes before the link's own expiry", async () => {
      const service = await exportsService();
      service.credentialsExpiry = new Date(Date.now() + 6 * 60_000);

      const result = await service.getExportDownloadUrl(
        "exports/e/raw_data/csv/x/part",
        "a.csv.gz",
      );

      assertSuccess(result);
      expect(result.value.expiresAt).toEqual(service.credentialsExpiry);
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
