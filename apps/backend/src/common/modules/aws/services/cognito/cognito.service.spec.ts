import {
  CognitoIdentityClient,
  GetOpenIdTokenForDeveloperIdentityCommand,
  GetCredentialsForIdentityCommand,
} from "@aws-sdk/client-cognito-identity";
import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import { mockClient } from "aws-sdk-client-mock";

import { AwsConfigService } from "../config/config.service";
import { CognitoService } from "./cognito.service";

const cognitoMock = mockClient(CognitoIdentityClient);

describe("CognitoService", () => {
  let service: CognitoService;

  beforeEach(async () => {
    cognitoMock.reset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CognitoService,
        {
          provide: AwsConfigService,
          useValue: {
            region: "eu-central-1",
            cognitoIdentityPoolId: "eu-central-1:test-pool-id",
            cognitoDeveloperProviderName: "login.openjii.com",
          },
        },
      ],
    }).compile();

    service = module.get<CognitoService>(CognitoService);
  });

  describe("getIoTCredentials", () => {
    it("should return IoT credentials for authenticated user", async () => {
      const userId = "test-user-123";
      const mockToken = "mock-openid-token";
      const mockIdentityId = "eu-central-1:identity-id-123";
      const mockExpiration = new Date("2026-02-06T12:00:00Z");

      // Mock GetOpenIdTokenForDeveloperIdentity
      cognitoMock.on(GetOpenIdTokenForDeveloperIdentityCommand).resolves({
        IdentityId: mockIdentityId,
        Token: mockToken,
      });

      // Mock GetCredentialsForIdentity
      cognitoMock.on(GetCredentialsForIdentityCommand).resolves({
        Credentials: {
          AccessKeyId: "AKIAIOSFODNN7EXAMPLE",
          SecretKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
          SessionToken: "mock-session-token",
          Expiration: mockExpiration,
        },
      });

      const result = await service.getIoTCredentials(userId);

      expect(result.isSuccess()).toBe(true);
      if (result.isSuccess()) {
        expect(result.value).toEqual({
          accessKeyId: "AKIAIOSFODNN7EXAMPLE",
          secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
          sessionToken: "mock-session-token",
          expiration: mockExpiration,
        });
      }
    });

    it("should fail when OpenID token is not returned", async () => {
      const userId = "test-user-123";

      cognitoMock.on(GetOpenIdTokenForDeveloperIdentityCommand).resolves({
        IdentityId: undefined,
        Token: undefined,
      });

      const result = await service.getIoTCredentials(userId);

      expect(result.isFailure()).toBe(true);
    });

    it("should fail when AWS credentials are not returned", async () => {
      const userId = "test-user-123";

      cognitoMock.on(GetOpenIdTokenForDeveloperIdentityCommand).resolves({
        IdentityId: "eu-central-1:identity-id-123",
        Token: "mock-token",
      });

      cognitoMock.on(GetCredentialsForIdentityCommand).resolves({
        Credentials: undefined,
      });

      const result = await service.getIoTCredentials(userId);

      expect(result.isFailure()).toBe(true);
    });

    it("should call AWS SDK with correct parameters", async () => {
      const userId = "test-user-123";

      cognitoMock.on(GetOpenIdTokenForDeveloperIdentityCommand).resolves({
        IdentityId: "eu-central-1:identity-id-123",
        Token: "mock-token",
      });

      cognitoMock.on(GetCredentialsForIdentityCommand).resolves({
        Credentials: {
          AccessKeyId: "test-key",
          SecretKey: "test-secret",
          SessionToken: "test-token",
          Expiration: new Date(),
        },
      });

      await service.getIoTCredentials(userId);

      // Verify the first call was made with correct parameters
      const tokenCalls = cognitoMock.commandCalls(GetOpenIdTokenForDeveloperIdentityCommand);
      expect(tokenCalls).toHaveLength(1);
      expect(tokenCalls[0].args[0].input).toMatchObject({
        IdentityPoolId: "eu-central-1:test-pool-id",
        Logins: {
          "login.openjii.com": userId,
        },
        TokenDuration: 900,
      });
    });
  });
});
