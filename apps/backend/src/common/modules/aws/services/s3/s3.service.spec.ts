import type { PutObjectCommand } from "@aws-sdk/client-s3";

import { assertFailure, assertSuccess } from "../../../../utils/fp-utils";
import type { AwsConfigService } from "../config/config.service";
import { AwsS3Service } from "./s3.service";

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
      protected override createSignedUrl(command: PutObjectCommand) {
        this.command = command;
        return super.createSignedUrl(command);
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
