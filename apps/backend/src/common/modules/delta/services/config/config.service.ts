import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { readFileSync } from "fs";

import type { DeltaConfig, DeltaProfile, DeltaEnvironmentVariables } from "./config.types";

@Injectable()
export class DeltaConfigService {
  private readonly logger = new Logger(DeltaConfigService.name);
  private readonly config: DeltaConfig;

  public static readonly DEFAULT_REQUEST_TIMEOUT = 30000; // 30 seconds
  public static readonly DEFAULT_MAX_RETRIES = 3;
  public static readonly DEFAULT_SHARE_CREDENTIALS_VERSION = 1;

  constructor(private readonly nestConfigService: ConfigService<DeltaEnvironmentVariables>) {
    this.config = this.loadConfiguration();
    this.validateConfig();
  }

  private loadConfiguration(): DeltaConfig {
    // Try to load from profile file first
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const profilePath = this.nestConfigService.get("DELTA_PROFILE_PATH");
    if (profilePath) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        const profileContent = readFileSync(profilePath, "utf-8");
        const profile = JSON.parse(profileContent) as DeltaProfile;
        return {
          profile,
          defaultRequestTimeout: this.parseRequestTimeout(),
          maxRetries: this.parseMaxRetries(),
        };
      } catch (error) {
        this.logger.warn(`Failed to load profile from ${profilePath}:`, error);
        this.logger.log("Falling back to environment variables");
      }
    }

    // Fallback to environment variables
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const endpoint = this.nestConfigService.get("DELTA_ENDPOINT");
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const bearerToken = this.nestConfigService.get("DELTA_BEARER_TOKEN");

    if (!endpoint || !bearerToken) {
      throw new Error(
        "Delta Sharing configuration missing. Provide either DELTA_PROFILE_PATH or both DELTA_ENDPOINT and DELTA_BEARER_TOKEN",
      );
    }

    // At this point, we know endpoint and bearerToken are truthy strings
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const cleanEndpoint =
      typeof endpoint === "string" && endpoint.endsWith("/") ? endpoint.slice(0, -1) : endpoint;

    const profile: DeltaProfile = {
      shareCredentialsVersion: DeltaConfigService.DEFAULT_SHARE_CREDENTIALS_VERSION,
      endpoint: cleanEndpoint as string,
      bearerToken: bearerToken as string,
    };

    return {
      profile,
      defaultRequestTimeout: this.parseRequestTimeout(),
      maxRetries: this.parseMaxRetries(),
    };
  }

  private parseRequestTimeout(): number {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const timeout = this.nestConfigService.get("DELTA_REQUEST_TIMEOUT");
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    return timeout ? parseInt(timeout, 10) : DeltaConfigService.DEFAULT_REQUEST_TIMEOUT;
  }

  private parseMaxRetries(): number {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const retries = this.nestConfigService.get("DELTA_MAX_RETRIES");
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    return retries ? parseInt(retries, 10) : DeltaConfigService.DEFAULT_MAX_RETRIES;
  }

  /**
   * Validates the loaded configuration
   */
  private validateConfig(): void {
    if (!this.config.profile.endpoint || !this.config.profile.bearerToken) {
      this.logger.error("Invalid Delta Sharing configuration");
      throw new Error("Invalid Delta Sharing configuration: endpoint and bearerToken are required");
    }
    this.logger.debug("Delta Sharing configuration validated successfully");
  }

  /**
   * Get the Delta Sharing endpoint URL
   */
  getEndpoint(): string {
    return this.config.profile.endpoint;
  }

  /**
   * Get the bearer token for authentication
   */
  getBearerToken(): string {
    return this.config.profile.bearerToken;
  }

  /**
   * Get the profile credentials version
   */
  getShareCredentialsVersion(): number {
    return this.config.profile.shareCredentialsVersion;
  }

  /**
   * Get the token expiration time if available
   */
  getExpirationTime(): string | undefined {
    return this.config.profile.expirationTime;
  }

  /**
   * Get the default request timeout in milliseconds
   */
  getRequestTimeout(): number {
    return this.config.defaultRequestTimeout;
  }

  /**
   * Get the maximum number of retries for failed requests
   */
  getMaxRetries(): number {
    return this.config.maxRetries;
  }

  /**
   * Check if the bearer token is expired (if expiration time is provided)
   */
  isTokenExpired(): boolean {
    if (!this.config.profile.expirationTime) {
      return false; // No expiration time means token doesn't expire
    }

    const expirationDate = new Date(this.config.profile.expirationTime);
    return new Date() >= expirationDate;
  }

  /**
   * Get the complete configuration object
   */
  getConfig(): DeltaConfig {
    return { ...this.config };
  }
}
