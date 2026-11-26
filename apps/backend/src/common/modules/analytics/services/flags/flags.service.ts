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
  // While PostHog times out, each evaluation waits out the client's timeout and its retry. After a
  // failed request, an evaluation the cache cannot answer takes the default without asking for
  // this long, so the wait is not paid per user and flag, and a recovered PostHog takes over once
  // it lapses.
  private static readonly FLAG_FALLBACK_TTL_MS = 10_000;
  // Keyed per (flag, user, person properties); insertion order makes the oldest the
  // eviction candidate.
  private static readonly FLAG_CACHE_MAX_ENTRIES = 5_000;
  private readonly flagCache = new Map<string, { value: boolean; expiresAt: number }>();
  // A page load evaluates one flag for several requests at once; they share one round trip.
  private readonly pendingEvaluations = new Map<string, Promise<boolean>>();
  private pausedUntil = 0;

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
   * @param personProperties - Evaluated as the person's properties, over what PostHog has stored
   * @returns Whether the flag is enabled (falls back to default on error)
   */
  async isFeatureFlagEnabled(
    flagKey: FeatureFlagKey,
    distinctId = "anonymous",
    personProperties?: Record<string, string>,
  ): Promise<boolean> {
    const cacheKey = this.cacheKeyFor(flagKey, distinctId, personProperties);
    const cached = this.flagCache.get(cacheKey);
    if (cached !== undefined && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    const isPaused = Date.now() < this.pausedUntil;
    if (isPaused) {
      return FEATURE_FLAG_DEFAULTS[flagKey];
    }

    const pending = this.pendingEvaluations.get(cacheKey);
    if (pending !== undefined) {
      return pending;
    }

    const evaluation = this.evaluate(flagKey, distinctId, cacheKey, personProperties).finally(() =>
      this.pendingEvaluations.delete(cacheKey),
    );
    this.pendingEvaluations.set(cacheKey, evaluation);
    return evaluation;
  }

  /**
   * As `isFeatureFlagEnabled`, except that a lapsed answer is returned at once while a fresh
   * evaluation runs behind it, so only a key with no answer held waits on PostHog. For a decision
   * that may follow a flag change one refresh late, never for one that must see it at once.
   */
  async isFeatureFlagEnabledOrStale(
    flagKey: FeatureFlagKey,
    distinctId = "anonymous",
    personProperties?: Record<string, string>,
  ): Promise<boolean> {
    const held = this.flagCache.get(this.cacheKeyFor(flagKey, distinctId, personProperties));
    if (held === undefined) {
      return this.isFeatureFlagEnabled(flagKey, distinctId, personProperties);
    }

    const isLapsed = held.expiresAt <= Date.now();
    if (isLapsed) {
      // Never rejects: a failed evaluation answers with the default and leaves this answer held.
      void this.isFeatureFlagEnabled(flagKey, distinctId, personProperties);
    }

    return held.value;
  }

  private cacheKeyFor(
    flagKey: FeatureFlagKey,
    distinctId: string,
    personProperties: Record<string, string> | undefined,
  ): string {
    return `${flagKey}:${distinctId}:${JSON.stringify(personProperties ?? {})}`;
  }

  private async evaluate(
    flagKey: FeatureFlagKey,
    distinctId: string,
    cacheKey: string,
    personProperties?: Record<string, string>,
  ): Promise<boolean> {
    try {
      const client = this.getPostHogClient();

      // If client is null (not initialized), return default
      if (!client) {
        this.logger.debug(
          `PostHog not initialized, using default for ${flagKey}: ${FEATURE_FLAG_DEFAULTS[flagKey]}`,
        );
        return FEATURE_FLAG_DEFAULTS[flagKey];
      }

      // posthog-node reports a failed request only as an error event, the same for every request
      // it makes, and answers a flag it could not ask for as it answers a missing one.
      const failures: unknown[] = [];
      const stopListening = client.on("error", (error) => failures.push(error));
      // Unless told otherwise, posthog-node records a $feature_flag_called event under the
      // distinct id, which creates the person before the user has consented.
      const isEnabled = await client
        .isFeatureEnabled(flagKey, distinctId, { personProperties, sendFeatureFlagEvents: false })
        .finally(stopListening);
      const result = isEnabled ?? FEATURE_FLAG_DEFAULTS[flagKey];

      this.logger.debug(
        `Feature flag ${flagKey} for ${distinctId}: ${result} (PostHog returned: ${isEnabled})`,
      );

      const isRealEvaluation = typeof isEnabled === "boolean";
      const hasFailedRequest = !isRealEvaluation && failures.length > 0;
      if (hasFailedRequest) {
        // The pause answers every uncached key; caching this default could only evict a live answer.
        this.pause();
        return result;
      }

      // A flag that is off or missing answers empty without a failure, and holds only its own key.
      this.remember(
        cacheKey,
        result,
        isRealEvaluation ? FlagsService.FLAG_CACHE_TTL_MS : FlagsService.FLAG_FALLBACK_TTL_MS,
      );

      return result;
    } catch (error) {
      this.logger.error({
        msg: "Error checking feature flag",
        errorCode: ErrorCodes.FEATURE_FLAG_FAILED,
        operation: "isFeatureFlagEnabled",
        flagKey,
        error,
      });

      this.pause();
      return FEATURE_FLAG_DEFAULTS[flagKey];
    }
  }

  private pause() {
    this.pausedUntil = Date.now() + FlagsService.FLAG_FALLBACK_TTL_MS;
  }

  private remember(cacheKey: string, value: boolean, ttlMs: number) {
    // A Map keeps a re-set key in its old place, which would make the newest entry the next
    // evicted.
    this.flagCache.delete(cacheKey);
    if (this.flagCache.size >= FlagsService.FLAG_CACHE_MAX_ENTRIES) {
      const oldest = this.flagCache.keys().next();
      if (!oldest.done) {
        this.flagCache.delete(oldest.value);
      }
    }

    this.flagCache.set(cacheKey, { value, expiresAt: Date.now() + ttlMs });
  }

  /**
   * Check if PostHog is properly initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }
}
