import { GetSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import { mockClient } from "aws-sdk-client-mock";
import { beforeEach, describe, expect, it } from "vitest";

import type { AwsConfigService } from "../config/config.service";
import { AwsSecretsManagerService } from "./secrets-manager.service";

const secretsManagerMock = mockClient(SecretsManagerClient);

describe("AwsSecretsManagerService", () => {
  let service: AwsSecretsManagerService;
  let configService: AwsConfigService;

  beforeEach(() => {
    secretsManagerMock.reset();

    configService = {
      region: "us-east-1",
    } as AwsConfigService;

    service = new AwsSecretsManagerService(configService);
  });

  describe("getSecret", () => {
    const secretArn = "arn:aws:secretsmanager:us-east-1:123456789012:secret:test-secret";
    const secretValue = { username: "admin", password: "pass123" };

    it("should fetch and cache a secret from AWS", async () => {
      secretsManagerMock.on(GetSecretValueCommand).resolves({
        SecretString: JSON.stringify(secretValue),
      });

      const result = await service.getSecret(secretArn);

      expect(result).toEqual(secretValue);
      expect(secretsManagerMock.calls()).toHaveLength(1);
    });

    it("should return cached value on subsequent calls", async () => {
      secretsManagerMock.on(GetSecretValueCommand).resolves({
        SecretString: JSON.stringify(secretValue),
      });

      await service.getSecret(secretArn);
      const result = await service.getSecret(secretArn);

      expect(result).toEqual(secretValue);
      expect(secretsManagerMock.calls()).toHaveLength(1);
    });

    it("should force refresh when forceRefresh is true", async () => {
      secretsManagerMock.on(GetSecretValueCommand).resolves({
        SecretString: JSON.stringify(secretValue),
      });

      await service.getSecret(secretArn);
      await service.getSecret(secretArn, true);

      expect(secretsManagerMock.calls()).toHaveLength(2);
    });

    it("should use cached value when AWS API fails and cache exists", async () => {
      secretsManagerMock.on(GetSecretValueCommand).resolvesOnce({
        SecretString: JSON.stringify(secretValue),
      });

      await service.getSecret(secretArn);

      secretsManagerMock.on(GetSecretValueCommand).rejectsOnce(new Error("AWS API Error"));

      const result = await service.getSecret(secretArn, true);

      expect(result).toEqual(secretValue);
    });

    it("should throw error when AWS fails and no cache exists", async () => {
      secretsManagerMock.on(GetSecretValueCommand).rejects(new Error("AWS API Error"));

      await expect(service.getSecret(secretArn)).rejects.toThrow("AWS API Error");
    });

    it("should throw error when secret does not contain a string value", async () => {
      secretsManagerMock.on(GetSecretValueCommand).resolves({
        SecretString: undefined,
      });

      await expect(service.getSecret(secretArn)).rejects.toThrow("does not contain a string value");
    });
  });

  describe("getDatabaseCredentials", () => {
    const secretArn = "arn:aws:secretsmanager:us-east-1:123456789012:secret:db-secret";

    it("should extract username and password from secret", async () => {
      const secretValue = { username: "dbadmin", password: "dbpass123" };

      secretsManagerMock.on(GetSecretValueCommand).resolves({
        SecretString: JSON.stringify(secretValue),
      });

      const result = await service.getDatabaseCredentials(secretArn);

      expect(result).toEqual({
        username: "dbadmin",
        password: "dbpass123",
      });
    });

    it("should throw error when username is missing", async () => {
      const secretValue = { password: "dbpass123" };

      secretsManagerMock.on(GetSecretValueCommand).resolves({
        SecretString: JSON.stringify(secretValue),
      });

      await expect(service.getDatabaseCredentials(secretArn)).rejects.toThrow(
        "does not contain required database credentials",
      );
    });

    it("should throw error when password is missing", async () => {
      const secretValue = { username: "dbadmin" };

      secretsManagerMock.on(GetSecretValueCommand).resolves({
        SecretString: JSON.stringify(secretValue),
      });

      await expect(service.getDatabaseCredentials(secretArn)).rejects.toThrow(
        "does not contain required database credentials",
      );
    });
  });

  describe("clearCache", () => {
    const secretArn = "arn:aws:secretsmanager:us-east-1:123456789012:secret:test-secret";
    const secretValue = { username: "admin", password: "pass123" };

    it("should clear cache for a specific secret", async () => {
      secretsManagerMock.on(GetSecretValueCommand).resolves({
        SecretString: JSON.stringify(secretValue),
      });

      await service.getSecret(secretArn);
      expect(secretsManagerMock.calls()).toHaveLength(1);

      service.clearCache(secretArn);

      await service.getSecret(secretArn);
      expect(secretsManagerMock.calls()).toHaveLength(2);
    });

    it("should clear all cached secrets when no ARN provided", async () => {
      const secretArn2 = "arn:aws:secretsmanager:us-east-1:123456789012:secret:another-secret";

      secretsManagerMock.on(GetSecretValueCommand).resolves({
        SecretString: JSON.stringify(secretValue),
      });

      await service.getSecret(secretArn);
      await service.getSecret(secretArn2);
      expect(secretsManagerMock.calls()).toHaveLength(2);

      service.clearCache();

      await service.getSecret(secretArn);
      await service.getSecret(secretArn2);
      expect(secretsManagerMock.calls()).toHaveLength(4);
    });
  });
});
