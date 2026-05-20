import type { PutObjectCommand } from "@aws-sdk/client-s3";

import { assertFailure, assertSuccess } from "../../../../utils/fp-utils";
import type { AwsConfigService } from "../config/config.service";
import { AwsS3Service } from "./s3.service";

describe("AwsS3Service", () => {
  let service: AwsS3Service;

  const mockAwsConfig = {
    region: "eu-central-1",
    s3Config: { iotArchiveBucketName: "test-iot-archive-bucket" },
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
      let capturedCommand: PutObjectCommand | undefined;
      vi.spyOn(service as any, "createSignedUrl").mockImplementation(
        (command: unknown) => {
          capturedCommand = command as PutObjectCommand;
          return Promise.resolve("https://mock-url");
        },
      );

      await service.getIotUploadUrl("experiment-abc");

      expect(capturedCommand?.input.Bucket).toBe("test-iot-archive-bucket");
      expect(capturedCommand?.input.Key).toMatch(/^large-iot\/experiment-abc\/.+\.json$/);
      expect(capturedCommand?.input.ContentType).toBe("application/json");
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
