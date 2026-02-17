import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import { describe, it, expect, beforeEach, vi } from "vitest";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import {
  success,
  failure,
  AppError,
  assertSuccess,
  assertFailure,
} from "../../../../common/utils/fp-utils";
import { COGNITO_PORT } from "../../../core/ports/cognito.port";
import type { CognitoPort } from "../../../core/ports/cognito.port";
import { GetIoTCredentialsUseCase } from "./get-iot-credentials";

describe("GetIoTCredentialsUseCase", () => {
  let useCase: GetIoTCredentialsUseCase;
  let mockCognitoPort: CognitoPort;

  beforeEach(async () => {
    mockCognitoPort = {
      getIoTCredentials: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetIoTCredentialsUseCase,
        {
          provide: COGNITO_PORT,
          useValue: mockCognitoPort,
        },
      ],
    }).compile();

    useCase = module.get<GetIoTCredentialsUseCase>(GetIoTCredentialsUseCase);
  });

  describe("execute", () => {
    it("should successfully return IoT credentials", async () => {
      const userId = "user-123";
      const mockCredentials = {
        accessKeyId: "AKIAIOSFODNN7EXAMPLE",
        secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
        sessionToken: "session-token",
        expiration: new Date("2024-01-01T12:00:00Z"),
      };

      vi.spyOn(mockCognitoPort, "getIoTCredentials").mockResolvedValue(success(mockCredentials));

      const result = await useCase.execute(userId);

      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toEqual(mockCredentials);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockCognitoPort.getIoTCredentials).toHaveBeenCalledWith(userId);
    });

    it("should return failure when cognito port fails", async () => {
      const userId = "user-123";
      const error = new AppError("Cognito error", ErrorCodes.AWS_COGNITO_CREDENTIALS_FAILED);

      vi.spyOn(mockCognitoPort, "getIoTCredentials").mockResolvedValue(failure(error));

      const result = await useCase.execute(userId);

      expect(result.isFailure()).toBe(true);
      assertFailure(result);
      expect(result.error).toEqual(error);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockCognitoPort.getIoTCredentials).toHaveBeenCalledWith(userId);
    });
  });
});
