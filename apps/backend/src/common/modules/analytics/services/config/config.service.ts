import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { createPostHogServerConfig } from "@repo/analytics";

import { AnalyticsConfig, analyticsConfigSchema } from "./config.types";

@Injectable()
export class AnalyticsConfigService {
  private readonly logger = new Logger(AnalyticsConfigService.name);
  private readonly config: AnalyticsConfig;

  constructor(private readonly configService: ConfigService) {
    this.config = this.loadConfig();
    this.validateConfig();
  }

  /**
   * Loads analytics configuration from environment variables
   */
  private loadConfig(): AnalyticsConfig {
    this.logger.debug("Loading analytics configuration");
    return {
      posthogKey: this.configService.getOrThrow("analytics.posthogKey"),
      posthogHost: this.configService.getOrThrow("analytics.posthogHost"),
    };
  }

  /**
   * Validates the loaded configuration
   */
  private validateConfig(): void {
    try {
      analyticsConfigSchema.parse(this.config);
      this.logger.debug("Analytics configuration validated successfully");
    } catch (error) {
      this.logger.error("Invalid analytics configuration", error);
      throw new Error(
        `Analytics configuration validation failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Gets the PostHog API key
   */
  get posthogKey(): string | undefined {
    return this.config.posthogKey;
  }

  /**
   * Gets the PostHog host URL
   */
  get posthogHost(): string {
    return this.config.posthogHost;
  }

  /**
   * Checks if PostHog is configured with a valid API key
   */
  isConfigured(): boolean {
    return (
      !!this.config.posthogKey &&
      this.config.posthogKey !== "phc_0000" &&
      !this.config.posthogKey.startsWith("phc_0000")
    );
  }

  /**
   * Gets PostHog server configuration
   */
  getPostHogServerConfig() {
    return createPostHogServerConfig(this.config.posthogHost);
  }
}
