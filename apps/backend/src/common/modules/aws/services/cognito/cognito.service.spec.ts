import {
  CognitoIdentityClient,
  GetOpenIdTokenForDeveloperIdentityCommand,
  GetCredentialsForIdentityCommand,
} from "@aws-sdk/client-cognito-identity";
import { mockClient } from "aws-sdk-client-mock";

import { assertFailure, assertSuccess } from "src/common/utils/fp-utils";

import { TestHarness } from "../../../../../test/test-harness";
import { CognitoService } from "./cognito.service";

const cognitoMock = mockClient(CognitoIdentityClient);

describe("CognitoService", () => {
  const testApp = TestHarness.App;
  let service: CognitoService;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    cognitoMock.reset();
    await testApp.beforeEach();
    service = testApp.module.get(CognitoService);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  describe("getOpenIdToken", () => {
    it("should return an OpenID token for an authenticated user", async () => {
      const userId = "test-user-123";
      const mockToken = "mock-openid-token";
      const mockIdentityId = "eu-central-1:identity-id-123";

      cognitoMock.on(GetOpenIdTokenForDeveloperIdentityCommand).resolves({
        IdentityId: mockIdentityId,
        Token: mockToken,
      });

      const result = await service.getOpenIdToken(userId);

      assertSuccess(result);
      expect(result.value).toEqual({
        identityId: mockIdentityId,
        token: mockToken,
      });
    });

    it("should fail when OpenID token is not returned", async () => {
      const userId = "test-user-123";

      cognitoMock.on(GetOpenIdTokenForDeveloperIdentityCommand).resolves({
        IdentityId: undefined,
        Token: undefined,
      });

      const result = await service.getOpenIdToken(userId);

      assertFailure(result);
    });

    it("should call AWS SDK with correct parameters", async () => {
      const userId = "test-user-123";

      cognitoMock.on(GetOpenIdTokenForDeveloperIdentityCommand).resolves({
        IdentityId: "eu-central-1:identity-id-123",
        Token: "mock-token",
      });

      await service.getOpenIdToken(userId);

      const tokenCalls = cognitoMock.commandCalls(GetOpenIdTokenForDeveloperIdentityCommand);
      expect(tokenCalls).toHaveLength(1);
      expect(tokenCalls[0].args[0].input).toMatchObject({
        IdentityPoolId: process.env.AWS_COGNITO_IDENTITY_POOL_ID,
        Logins: {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          [process.env.AWS_COGNITO_DEVELOPER_PROVIDER_NAME!]: userId,
        },
        TokenDuration: 900,
      });
    });

    it("should handle AWS SDK errors gracefully", async () => {
      const userId = "test-user-123";

      cognitoMock.on(GetOpenIdTokenForDeveloperIdentityCommand).rejects(new Error("AWS SDK error"));

      const result = await service.getOpenIdToken(userId);

      assertFailure(result);
      expect(result.error.message).toBe("AWS SDK error");
    });

    it("should handle non-Error thrown values", async () => {
      const userId = "test-user-123";

      cognitoMock.on(GetOpenIdTokenForDeveloperIdentityCommand).rejects("string error");

      const result = await service.getOpenIdToken(userId);

      assertFailure(result);
    });
  });

  describe("getCredentialsForIdentity", () => {
    it("should return AWS credentials for a valid identity and token", async () => {
      const identityId = "eu-central-1:identity-id-123";
      const token = "mock-openid-token";
      const mockExpiration = new Date("2026-02-06T12:00:00Z");

      cognitoMock.on(GetCredentialsForIdentityCommand).resolves({
        Credentials: {
          AccessKeyId: "AKIAIOSFODNN7EXAMPLE",
          SecretKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
          SessionToken: "mock-session-token",
          Expiration: mockExpiration,
        },
      });

      const result = await service.getCredentialsForIdentity(identityId, token);

      assertSuccess(result);
      expect(result.value).toEqual({
        accessKeyId: "AKIAIOSFODNN7EXAMPLE",
        secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
        sessionToken: "mock-session-token",
        expiration: mockExpiration,
      });
    });

    it("should fail when AWS credentials are not returned", async () => {
      const identityId = "eu-central-1:identity-id-123";
      const token = "mock-token";

      cognitoMock.on(GetCredentialsForIdentityCommand).resolves({
        Credentials: undefined,
      });

      const result = await service.getCredentialsForIdentity(identityId, token);

      assertFailure(result);
    });

    it("should call AWS SDK with correct parameters", async () => {
      const identityId = "eu-central-1:identity-id-123";
      const token = "mock-openid-token";

      cognitoMock.on(GetCredentialsForIdentityCommand).resolves({
        Credentials: {
          AccessKeyId: "test-key",
          SecretKey: "test-secret",
          SessionToken: "test-token",
          Expiration: new Date(),
        },
      });

      await service.getCredentialsForIdentity(identityId, token);

      const credentialsCalls = cognitoMock.commandCalls(GetCredentialsForIdentityCommand);
      expect(credentialsCalls).toHaveLength(1);
      expect(credentialsCalls[0].args[0].input).toMatchObject({
        IdentityId: identityId,
        Logins: {
          "cognito-identity.amazonaws.com": token,
        },
      });
    });

    it("should handle AWS SDK errors gracefully", async () => {
      const identityId = "eu-central-1:identity-id-123";
      const token = "mock-token";

      cognitoMock.on(GetCredentialsForIdentityCommand).rejects(new Error("AWS SDK error"));

      const result = await service.getCredentialsForIdentity(identityId, token);

      assertFailure(result);
      expect(result.error.message).toBe("AWS SDK error");
    });

    it("should handle non-Error thrown values", async () => {
      const identityId = "eu-central-1:identity-id-123";
      const token = "mock-token";

      cognitoMock.on(GetCredentialsForIdentityCommand).rejects("string error");

      const result = await service.getCredentialsForIdentity(identityId, token);

      assertFailure(result);
    });

    it("should use default expiration when Expiration is undefined", async () => {
      const identityId = "eu-central-1:identity-id-123";
      const token = "mock-openid-token";

      cognitoMock.on(GetCredentialsForIdentityCommand).resolves({
        Credentials: {
          AccessKeyId: "AKIAIOSFODNN7EXAMPLE",
          SecretKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
          SessionToken: "mock-session-token",
          Expiration: undefined,
        },
      });

      const result = await service.getCredentialsForIdentity(identityId, token);

      assertSuccess(result);
      expect(result.value.expiration).toBeInstanceOf(Date);
    });
  });
});
