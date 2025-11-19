import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";

import type { FeatureFlagKey } from "@repo/analytics";
import { FEATURE_FLAG_DEFAULTS } from "@repo/analytics";
import {
  getPostHogServerClient,
  initializePostHogServer,
  shutdownPostHog,
} from "@repo/analytics/server";

import { AnalyticsConfigService } from "../config/config.service";

/**
 * Service for managing feature flags via PostHog
 */
@Injectable()
export class FlagsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(FlagsService.name);
  private initialized = false;

  constructor(private readonly configService: AnalyticsConfigService) {}

  async onModuleInit() {
    if (!this.configService.isConfigured()) {
      this.logger.warn(
        "PostHog not configured - feature flags will use default values. Set POSTHOG_KEY environment variable to enable.",
      );
      return;
    }

    try {
      const posthogKey = this.configService.posthogKey;
      if (!posthogKey) {
        this.logger.warn("PostHog key is missing after configuration check");
        return;
      }

      this.initialized = await initializePostHogServer(
        posthogKey,
        this.configService.getPostHogServerConfig(),
      );
      if (this.initialized) {
        this.logger.log("PostHog initialized successfully");
      } else {
        this.logger.warn("PostHog initialization failed - using default feature flag values");
      }
    } catch (error) {
      this.logger.error("Failed to initialize PostHog", error);
    }
  }

  async onModuleDestroy() {
    if (this.initialized) {
      await shutdownPostHog();
      this.logger.log("PostHog shutdown completed");
    }
  }

  /**
   * Check if a feature flag is enabled
   * @param flagKey - The feature flag key to check
   * @param distinctId - User identifier (defaults to 'anonymous')
   * @returns Whether the flag is enabled (falls back to default on error)
   */
  async isFeatureFlagEnabled(flagKey: FeatureFlagKey, distinctId = "anonymous"): Promise<boolean> {
    try {
      const client = getPostHogServerClient();

      // If client is null (not initialized), return default
      if (!client) {
        this.logger.debug(
          `PostHog not initialized, using default for ${flagKey}: ${FEATURE_FLAG_DEFAULTS[flagKey]}`,
        );
        return FEATURE_FLAG_DEFAULTS[flagKey];
      }

      const isEnabled = await client.isFeatureEnabled(flagKey, distinctId);
      const result = isEnabled ?? FEATURE_FLAG_DEFAULTS[flagKey];

      this.logger.debug(
        `Feature flag ${flagKey} for ${distinctId}: ${result} (PostHog returned: ${isEnabled})`,
      );

      return result;
    } catch (error) {
      this.logger.error(`Error checking feature flag ${flagKey}:`, error);
      return FEATURE_FLAG_DEFAULTS[flagKey];
    }
  }

  /**
   * Check if PostHog is properly initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }
}
