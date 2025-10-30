import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

interface DeltaConfig {
  endpoint: string;
  bearerToken: string;
  requestTimeout: number;
  maxRetries: number;
}

@Injectable()
export class DeltaConfigService {
  private readonly logger = new Logger(DeltaConfigService.name);
  private readonly config: DeltaConfig;

  private static readonly DEFAULT_REQUEST_TIMEOUT = 30000; // 30 seconds
  private static readonly DEFAULT_MAX_RETRIES = 3;

  constructor(private readonly configService: ConfigService) {
    this.config = this.loadConfig();
    this.validateConfig();
  }

  /**
   * Loads Delta Sharing configuration from environment variables
   */
  private loadConfig(): DeltaConfig {
    this.logger.debug("Loading Delta Sharing configuration");

    const endpoint = this.configService.get<string>("delta.endpoint");
    const bearerToken = this.configService.get<string>("delta.bearerToken");
    const requestTimeoutStr = this.configService.get<string>("delta.requestTimeout");
    const maxRetriesStr = this.configService.get<string>("delta.maxRetries");

    // Parse timeout with fallback
    let requestTimeout = DeltaConfigService.DEFAULT_REQUEST_TIMEOUT;
    if (requestTimeoutStr) {
      const parsed = parseInt(requestTimeoutStr, 10);
      if (!isNaN(parsed)) {
        requestTimeout = parsed;
      }
    }

    // Parse max retries with fallback
    let maxRetries = DeltaConfigService.DEFAULT_MAX_RETRIES;
    if (maxRetriesStr) {
      const parsed = parseInt(maxRetriesStr, 10);
      if (!isNaN(parsed)) {
        maxRetries = parsed;
      }
    }

    return {
      endpoint: endpoint ?? "",
      bearerToken: bearerToken ?? "",
      requestTimeout,
      maxRetries,
    };
  }

  /**
   * Validates the loaded configuration
   */
  private validateConfig(): void {
    if (!this.config.endpoint || !this.config.bearerToken) {
      this.logger.error("Invalid Delta Sharing configuration");
      throw new Error(
        "Invalid Delta Sharing configuration: DELTA_ENDPOINT and DELTA_BEARER_TOKEN are required",
      );
    }
    this.logger.debug("Delta Sharing configuration validated successfully");
  }

  /**
   * Get the Delta Sharing endpoint URL
   */
  getEndpoint(): string {
    // Remove trailing slash if present
    return this.config.endpoint.endsWith("/")
      ? this.config.endpoint.slice(0, -1)
      : this.config.endpoint;
  }

  /**
   * Get the bearer token for authentication
   */
  getBearerToken(): string {
    return this.config.bearerToken;
  }

  /**
   * Get the default request timeout in milliseconds
   */
  getRequestTimeout(): number {
    return this.config.requestTimeout;
  }

  /**
   * Get the maximum number of retries for failed requests
   */
  getMaxRetries(): number {
    return this.config.maxRetries;
  }
}
