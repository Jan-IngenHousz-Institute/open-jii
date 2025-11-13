import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";

import type { FeatureFlagKey } from "@repo/analytics";
import { FEATURE_FLAG_DEFAULTS, createPostHogServerConfig } from "@repo/analytics";
import {
  getPostHogServerClient,
  initializePostHogServer,
  shutdownPostHog,
} from "@repo/analytics/server";

/**
 * Analytics service for feature flags and event tracking
 * Wraps PostHog functionality in a NestJS-friendly way
 */
@Injectable()
export class AnalyticsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AnalyticsService.name);
  private initialized = false;

  async onModuleInit() {
    const posthogKey = process.env.POSTHOG_KEY ?? process.env.NEXT_PUBLIC_POSTHOG_KEY;
    const posthogHost =
      process.env.POSTHOG_HOST ??
      process.env.NEXT_PUBLIC_POSTHOG_HOST ??
      "https://eu.i.posthog.com";

    if (!posthogKey || posthogKey === "phc_0000" || posthogKey.startsWith("phc_0000")) {
      this.logger.warn(
        "PostHog not configured - feature flags will use default values. Set POSTHOG_KEY environment variable to enable.",
      );
      return;
    }

    try {
      this.initialized = await initializePostHogServer(
        posthogKey,
        createPostHogServerConfig(posthogHost),
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
