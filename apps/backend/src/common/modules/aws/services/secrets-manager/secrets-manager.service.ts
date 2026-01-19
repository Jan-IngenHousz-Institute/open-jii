import { GetSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import { Injectable, Logger } from "@nestjs/common";

import { AwsConfigService } from "../config/config.service";
import type { CachedSecret, DatabaseCredentials } from "./secrets-manager.types";

@Injectable()
export class AwsSecretsManagerService {
  private readonly logger = new Logger(AwsSecretsManagerService.name);
  private readonly client: SecretsManagerClient;
  private readonly cache = new Map<string, CachedSecret>();
  private readonly cacheTTL = 300000; // 5 minutes

  constructor(private readonly configService: AwsConfigService) {
    this.client = new SecretsManagerClient({
      region: this.configService.region,
    });
    this.logger.debug("SecretsManager client initialized");
  }

  /**
   * Fetch a secret from AWS Secrets Manager with caching
   */
  async getSecret(secretArn: string, forceRefresh = false): Promise<Record<string, unknown>> {
    const now = Date.now();
    const cached = this.cache.get(secretArn);

    // Return cached value if it's still valid and not forced to refresh
    if (cached && !forceRefresh && now - cached.fetchedAt < this.cacheTTL) {
      this.logger.debug(`Using cached value for secret: ${secretArn}`);
      return cached.value;
    }

    try {
      this.logger.debug(`Fetching secret from AWS: ${secretArn}`);

      const command = new GetSecretValueCommand({
        SecretId: secretArn,
      });

      const response = await this.client.send(command);

      if (!response.SecretString) {
        throw new Error(`Secret ${secretArn} does not contain a string value`);
      }

      const secretValue = JSON.parse(response.SecretString) as Record<string, unknown>;

      // Cache the secret
      this.cache.set(secretArn, {
        value: secretValue,
        fetchedAt: now,
      });

      this.logger.debug(`Successfully fetched and cached secret: ${secretArn}`);

      return secretValue;
    } catch (error) {
      // If fetching fails but we have a cached value, return it
      if (cached) {
        this.logger.warn(
          `Failed to refresh secret ${secretArn}, using cached value`,
          error instanceof Error ? error.message : String(error),
        );
        return cached.value;
      }

      this.logger.error(`Failed to fetch secret ${secretArn}`, error);
      throw error;
    }
  }

  /**
   * Get database credentials from a secret
   * Expects secret to contain 'username' and 'password' fields
   */
  async getDatabaseCredentials(secretArn: string): Promise<DatabaseCredentials> {
    this.logger.debug(`Fetching database credentials from secret: ${secretArn}`);

    const secret = await this.getSecret(secretArn);

    if (!secret.username || !secret.password) {
      throw new Error(
        `Secret ${secretArn} does not contain required database credentials (username, password)`,
      );
    }

    this.logger.debug(`Successfully retrieved database credentials from secret: ${secretArn}`);

    return {
      username: secret.username as string,
      password: secret.password as string,
    };
  }

  /**
   * Clear cache for a specific secret or all secrets
   */
  clearCache(secretArn?: string): void {
    if (secretArn) {
      this.cache.delete(secretArn);
      this.logger.debug(`Cleared cache for secret: ${secretArn}`);
    } else {
      this.cache.clear();
      this.logger.debug("Cleared all secret cache");
    }
  }
}
