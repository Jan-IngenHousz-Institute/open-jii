import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";

import type { FeatureFlagKey } from "@repo/analytics";
import { FEATURE_FLAG_DEFAULTS } from "@repo/analytics";
import {
  getPostHogServerClient,
  initializePostHogServer,
  shutdownPostHog,
} from "@repo/analytics/server";

import { ErrorCodes } from "../../../../utils/error-codes";
import { AnalyticsConfigService } from "../config/config.service";

/**
 * Service for managing feature flags via PostHog
 */
@Injectable()
export class FlagsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(FlagsService.name);
  private initialized = false;

  // Every evaluation is an HTTP round trip and polling surfaces hit flagged
  // routes several times a minute; a minute of staleness is fine.
  private static readonly FLAG_CACHE_TTL_MS = 60_000;
  // Keyed per (flag, user); insertion order makes the oldest the eviction candidate.
  private static readonly FLAG_CACHE_MAX_ENTRIES = 5_000;
  private readonly flagCache = new Map<string, { value: boolean; expiresAt: number }>();

  constructor(private readonly configService: AnalyticsConfigService) {}

  /* v8 ignore next 3 */
  protected initializePostHog(...args: Parameters<typeof initializePostHogServer>) {
    return initializePostHogServer(...args);
  }

  /* v8 ignore next 3 */
  protected getPostHogClient(): ReturnType<typeof getPostHogServerClient> {
    return getPostHogServerClient();
  }

  /* v8 ignore next 3 */
  protected shutdownPostHogClient() {
    return shutdownPostHog();
  }

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
          errorCode: ErrorCodes.ANALYTICS_INIT_FAILED,
          operation: "initialize",
        });
        return;
      }

      this.initialized = await this.initializePostHog(
        posthogKey,
        this.configService.getPostHogServerConfig(),
      );
      if (this.initialized) {
        this.logger.log({
          msg: "PostHog initialized successfully",
          operation: "initialize",
          status: "success",
        });
      } else {
        this.logger.warn({
          msg: "PostHog initialization failed - using default feature flag values",
          errorCode: ErrorCodes.ANALYTICS_INIT_FAILED,
          operation: "initialize",
        });
      }
    } catch (error) {
      this.logger.error({
        msg: "Failed to initialize PostHog",
        errorCode: ErrorCodes.ANALYTICS_INIT_FAILED,
        operation: "initialize",
        error,
      });
    }
  }

  async onModuleDestroy() {
    if (this.initialized) {
      await this.shutdownPostHogClient();
      this.logger.log({
        msg: "PostHog shutdown completed",
        operation: "onModuleDestroy",
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
    const cacheKey = `${flagKey}:${distinctId}`;
    const cached = this.flagCache.get(cacheKey);
    if (cached !== undefined && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    try {
      const client = this.getPostHogClient();

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

      // Cache only real evaluations; pinning a fallback default would keep a
      // flag dark after PostHog starts resolving.
      if (typeof isEnabled === "boolean") {
        if (this.flagCache.size >= FlagsService.FLAG_CACHE_MAX_ENTRIES) {
          const oldest = this.flagCache.keys().next();
          if (!oldest.done) {
            this.flagCache.delete(oldest.value);
          }
        }
        this.flagCache.set(cacheKey, {
          value: isEnabled,
          expiresAt: Date.now() + FlagsService.FLAG_CACHE_TTL_MS,
        });
      }

      return result;
    } catch (error) {
      this.logger.error({
        msg: "Error checking feature flag",
        errorCode: ErrorCodes.FEATURE_FLAG_FAILED,
        operation: "isFeatureFlagEnabled",
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
