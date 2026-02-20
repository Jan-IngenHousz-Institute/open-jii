import { StatusCodes } from "http-status-codes";

import { contract } from "@repo/api";

import { AwsAdapter } from "../../common/modules/aws/aws.adapter";
import { ErrorCodes } from "../../common/utils/error-codes";
import { AppError, success, failure } from "../../common/utils/fp-utils";
import { TestHarness } from "../../test/test-harness";

describe("IotController", () => {
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
        .get(contract.iot.getCredentials.path)
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
        .get(contract.iot.getCredentials.path)
        .withoutAuth()
        .expect(StatusCodes.UNAUTHORIZED);
    });

    it("should return 500 when AWS adapter fails", async () => {
      vi.spyOn(awsAdapter, "getIotCredentials").mockResolvedValue(
        failure(AppError.internal("Cognito error", ErrorCodes.AWS_COGNITO_CREDENTIALS_FAILED)),
      );

      await testApp
        .get(contract.iot.getCredentials.path)
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
        .get(contract.iot.getCredentials.path)
        .withAuth(testUserId)
        .expect(StatusCodes.OK);

      expect(spy).toHaveBeenCalledWith(testUserId);
    });
  });
});
