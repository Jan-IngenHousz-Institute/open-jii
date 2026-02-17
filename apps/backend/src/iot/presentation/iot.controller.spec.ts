import { StatusCodes } from "http-status-codes";

import { ErrorCodes } from "../../common/utils/error-codes";
import { AppError, success, failure } from "../../common/utils/fp-utils";
import { TestHarness } from "../../test/test-harness";
import { GetIoTCredentialsUseCase } from "../application/use-cases/get-iot-credentials/get-iot-credentials";

describe("IoTController", () => {
  const testApp = TestHarness.App;
  let testUserId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  describe("POST /api/v1/iot/credentials", () => {
    const path = "/api/v1/iot/credentials";

    it("should return IoT credentials for authenticated user", async () => {
      // Mock the use case
      const mockCredentials = {
        accessKeyId: "AKIAIOSFODNN7EXAMPLE",
        secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
        sessionToken: "mock-session-token",
        expiration: new Date("2026-02-06T12:00:00Z"),
      };

      const useCase = testApp.module.get(GetIoTCredentialsUseCase);
      vi.spyOn(useCase, "execute").mockResolvedValue(success(mockCredentials));

      const response = await testApp
        .post(path)
        .withAuth(testUserId)
        .send({})
        .expect(StatusCodes.OK);

      expect(response.body).toEqual({
        accessKeyId: mockCredentials.accessKeyId,
        secretAccessKey: mockCredentials.secretAccessKey,
        sessionToken: mockCredentials.sessionToken,
        expiration: mockCredentials.expiration.toISOString(),
      });
    });

    it("should return 401 when user is not authenticated", async () => {
      await testApp.post(path).withoutAuth().send({}).expect(StatusCodes.UNAUTHORIZED);
    });

    it("should return 500 when Cognito service fails", async () => {
      const useCase = testApp.module.get(GetIoTCredentialsUseCase);
      vi.spyOn(useCase, "execute").mockResolvedValue(
        failure(new AppError("Cognito error", ErrorCodes.AWS_COGNITO_CREDENTIALS_FAILED)),
      );

      await testApp
        .post(path)
        .withAuth(testUserId)
        .send({})
        .expect(StatusCodes.INTERNAL_SERVER_ERROR);
    });

    it("should call Cognito service with authenticated user ID", async () => {
      const mockCredentials = {
        accessKeyId: "test-key",
        secretAccessKey: "test-secret",
        sessionToken: "test-token",
        expiration: new Date(),
      };

      const useCase = testApp.module.get(GetIoTCredentialsUseCase);
      const spy = vi.spyOn(useCase, "execute").mockResolvedValue(success(mockCredentials));

      await testApp.post(path).withAuth(testUserId).send({}).expect(StatusCodes.OK);

      expect(spy).toHaveBeenCalledWith(testUserId);
    });
  });
});
