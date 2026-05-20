import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { mockClient } from "aws-sdk-client-mock";

import { TestHarness } from "../../../../../test/test-harness";
import { assertFailure, assertSuccess } from "../../../../utils/fp-utils";
import { AwsS3Service } from "./s3.service";

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: vi.fn(),
}));

const s3Mock = mockClient(S3Client);

describe("AwsS3Service", () => {
  const testApp = TestHarness.App;
  let service: AwsS3Service;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    s3Mock.reset();
    vi.mocked(getSignedUrl).mockReset();
    await testApp.beforeEach();
    service = testApp.module.get(AwsS3Service);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  describe("getIotUploadUrl", () => {
    it("returns a presigned upload URL with key and expiry", async () => {
      const mockUrl = "https://s3.amazonaws.com/test-bucket/large-iot/exp-123/uuid.json?signed=1";
      vi.mocked(getSignedUrl).mockResolvedValue(mockUrl);

      const result = await service.getIotUploadUrl("exp-123");

      assertSuccess(result);
      expect(result.value.uploadUrl).toBe(mockUrl);
      expect(result.value.key).toMatch(/^large-iot\/exp-123\/.+\.json$/);
      expect(result.value.expiresAt).toBeInstanceOf(Date);
      expect(result.value.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it("passes correct bucket, key prefix, and content type to PutObjectCommand", async () => {
      vi.mocked(getSignedUrl).mockResolvedValue("https://mock-url");

      await service.getIotUploadUrl("experiment-abc");

      const [, command] = vi.mocked(getSignedUrl).mock.calls[0]!;
      expect((command as PutObjectCommand).input.Bucket).toBe("test-iot-archive-bucket");
      expect((command as PutObjectCommand).input.Key).toMatch(
        /^large-iot\/experiment-abc\/.+\.json$/,
      );
      expect((command as PutObjectCommand).input.ContentType).toBe("application/json");
    });

    it("returns failure with AWS_S3_PRESIGN_FAILED when getSignedUrl throws", async () => {
      vi.mocked(getSignedUrl).mockRejectedValue(new Error("Credentials expired"));

      const result = await service.getIotUploadUrl("exp-123");

      assertFailure(result);
      expect(result.error.message).toBe("Credentials expired");
      expect(result.error.code).toBe("AWS_S3_PRESIGN_FAILED");
    });

    it("wraps non-Error throws into a failure with AWS_S3_PRESIGN_FAILED", async () => {
      vi.mocked(getSignedUrl).mockRejectedValue("something unexpected");

      const result = await service.getIotUploadUrl("exp-123");

      assertFailure(result);
      expect(result.error.message).toBe("Unknown error");
      expect(result.error.code).toBe("AWS_S3_PRESIGN_FAILED");
    });
  });
});
