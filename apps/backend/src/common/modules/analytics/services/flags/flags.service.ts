import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";

import type { FeatureFlagKey } from "@repo/analytics";
import { FEATURE_FLAG_DEFAULTS } from "@repo/analytics";
import {
  getPostHogServerClient,
  initializePostHogServer,
  shutdownPostHog,
} from "@repo/analytics/server";

import { ANALYTICS_INIT_FAILED, FEATURE_FLAG_FAILED } from "../../../../utils/error-codes";
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
        this.logger.warn({
          msg: "PostHog key is missing after configuration check",
          errorCode: ANALYTICS_INIT_FAILED,
          operation: "initialize",
          context: FlagsService.name,
        });
        return;
      }

      this.initialized = await initializePostHogServer(
        posthogKey,
        this.configService.getPostHogServerConfig(),
      );
      if (this.initialized) {
        this.logger.log({
          msg: "PostHog initialized successfully",
          operation: "initialize",
          context: FlagsService.name,
          status: "success",
        });
      } else {
        this.logger.warn({
          msg: "PostHog initialization failed - using default feature flag values",
          errorCode: ANALYTICS_INIT_FAILED,
          operation: "initialize",
          context: FlagsService.name,
        });
      }
    } catch (error) {
      this.logger.error({
        msg: "Failed to initialize PostHog",
        errorCode: ANALYTICS_INIT_FAILED,
        operation: "initialize",
        context: FlagsService.name,
        error,
      });
    }
  }

  async onModuleDestroy() {
    if (this.initialized) {
      await shutdownPostHog();
      this.logger.log({
        msg: "PostHog shutdown completed",
        operation: "onModuleDestroy",
        context: FlagsService.name,
        status: "success",
      });
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
      this.logger.error({
        msg: "Error checking feature flag",
        errorCode: FEATURE_FLAG_FAILED,
        operation: "isFeatureFlagEnabled",
        context: FlagsService.name,
        flagKey,
        error,
      });
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
