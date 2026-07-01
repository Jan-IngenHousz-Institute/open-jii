import { StatusCodes } from "http-status-codes";

import { orpcContract } from "@repo/api/orpc-contract";

import { AwsAdapter } from "../../common/modules/aws/aws.adapter";
import { ErrorCodes } from "../../common/utils/error-codes";
import { AppError, failure, success } from "../../common/utils/fp-utils";
import { TestHarness } from "../../test/test-harness";

describe("IotOrpcController", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let awsAdapter: AwsAdapter;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    awsAdapter = testApp.module.get(AwsAdapter);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  describe("getCredentials", () => {
    it("should return IoT credentials for authenticated user", async () => {
      const mockCredentials = {
        accessKeyId: "AKIAIOSFODNN7EXAMPLE",
        secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
        sessionToken: "mock-session-token",
        expiration: new Date("2026-02-06T12:00:00Z"),
      };

      vi.spyOn(awsAdapter, "getIotCredentials").mockResolvedValue(success(mockCredentials));

      const response = await testApp
        .get(testApp.resolveOrpcPath(orpcContract.iot.getCredentials))
        .withAuth(testUserId)
        .expect(StatusCodes.OK);

      expect(response.body).toEqual({
        accessKeyId: mockCredentials.accessKeyId,
        secretAccessKey: mockCredentials.secretAccessKey,
        sessionToken: mockCredentials.sessionToken,
        expiration: mockCredentials.expiration.toISOString(),
      });
    });

    it("should return 401 when user is not authenticated", async () => {
      await testApp
        .get(testApp.resolveOrpcPath(orpcContract.iot.getCredentials))
        .withoutAuth()
        .expect(StatusCodes.UNAUTHORIZED);
    });

    it("should return 500 when AWS adapter fails", async () => {
      vi.spyOn(awsAdapter, "getIotCredentials").mockResolvedValue(
        failure(AppError.internal("Cognito error", ErrorCodes.AWS_COGNITO_CREDENTIALS_FAILED)),
      );

      await testApp
        .get(testApp.resolveOrpcPath(orpcContract.iot.getCredentials))
        .withAuth(testUserId)
        .expect(StatusCodes.INTERNAL_SERVER_ERROR);
    });

    it("should call AWS adapter with authenticated user ID", async () => {
      const mockCredentials = {
        accessKeyId: "test-key",
        secretAccessKey: "test-secret",
        sessionToken: "test-token",
        expiration: new Date(),
      };

      const spy = vi
        .spyOn(awsAdapter, "getIotCredentials")
        .mockResolvedValue(success(mockCredentials));

      await testApp
        .get(testApp.resolveOrpcPath(orpcContract.iot.getCredentials))
        .withAuth(testUserId)
        .expect(StatusCodes.OK);

      expect(spy).toHaveBeenCalledWith(testUserId);
    });
  });

  describe("getUploadUrl", () => {
    const mockUploadUrl = {
      uploadUrl: "https://bucket.s3.amazonaws.com/presigned",
      key: "large-iot/exp-id/uuid.json",
      expiresAt: new Date("2026-05-13T12:15:00Z"),
    };

    it("should return 200 with upload URL when user is a member", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Upload Test Experiment",
        userId: testUserId,
      });

      vi.spyOn(awsAdapter, "getIotUploadUrl").mockResolvedValue(success(mockUploadUrl));

      const response = await testApp
        .post(testApp.resolveOrpcPath(orpcContract.iot.getUploadUrl))
        .withAuth(testUserId)
        .send({ experimentId: experiment.id })
        .expect(StatusCodes.OK);

      expect(response.body).toEqual({
        uploadUrl: mockUploadUrl.uploadUrl,
        key: mockUploadUrl.key,
        expiresAt: mockUploadUrl.expiresAt.toISOString(),
      });
    });

    it("should return 401 when user is not authenticated", async () => {
      await testApp
        .post(testApp.resolveOrpcPath(orpcContract.iot.getUploadUrl))
        .withoutAuth()
        .send({ experimentId: "123e4567-e89b-12d3-a456-426614174000" })
        .expect(StatusCodes.UNAUTHORIZED);
    });

    it("should return 400 when experimentId is not a valid UUID", async () => {
      await testApp
        .post(testApp.resolveOrpcPath(orpcContract.iot.getUploadUrl))
        .withAuth(testUserId)
        .send({ experimentId: "not-a-uuid" })
        .expect(StatusCodes.BAD_REQUEST);
    });

    it("should return 404 when experiment does not exist", async () => {
      await testApp
        .post(testApp.resolveOrpcPath(orpcContract.iot.getUploadUrl))
        .withAuth(testUserId)
        .send({ experimentId: "123e4567-e89b-12d3-a456-426614174000" })
        .expect(StatusCodes.NOT_FOUND);
    });

    it("should return 403 when user is not a member of the experiment", async () => {
      const ownerId = await testApp.createTestUser({});
      const { experiment } = await testApp.createExperiment({
        name: "Other User Experiment",
        userId: ownerId,
      });

      await testApp
        .post(testApp.resolveOrpcPath(orpcContract.iot.getUploadUrl))
        .withAuth(testUserId)
        .send({ experimentId: experiment.id })
        .expect(StatusCodes.FORBIDDEN);
    });

    it("should return 500 when AWS adapter fails", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "AWS Failure Experiment",
        userId: testUserId,
      });

      vi.spyOn(awsAdapter, "getIotUploadUrl").mockResolvedValue(
        failure(AppError.internal("S3 error", ErrorCodes.AWS_S3_PRESIGN_FAILED)),
      );

      await testApp
        .post(testApp.resolveOrpcPath(orpcContract.iot.getUploadUrl))
        .withAuth(testUserId)
        .send({ experimentId: experiment.id })
        .expect(StatusCodes.INTERNAL_SERVER_ERROR);
    });
  });
});
