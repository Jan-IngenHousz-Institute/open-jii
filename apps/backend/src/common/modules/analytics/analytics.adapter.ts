import { Injectable, Logger } from "@nestjs/common";

import type { FeatureFlagKey } from "@repo/analytics";

import type { AnalyticsPort } from "../../../protocols/core/ports/analytics.port";
import { FlagsService } from "./services/flags/flags.service";

/**
 * Analytics adapter that implements the AnalyticsPort
 * Provides feature flag checking functionality to domains
 */
@Injectable()
export class AnalyticsAdapter implements AnalyticsPort {
  private readonly logger = new Logger(AnalyticsAdapter.name);

  constructor(private readonly flagsService: FlagsService) {}

  /**
   * Check if a feature flag is enabled
   * @param flagKey - The feature flag key to check
   * @param distinctId - Optional user identifier (defaults to 'anonymous')
   * @returns Whether the flag is enabled
   */
  async isFeatureFlagEnabled(flagKey: FeatureFlagKey, distinctId = "anonymous"): Promise<boolean> {
    this.logger.debug({
      msg: "Checking feature flag",
      operation: "isFeatureFlagEnabled",
      flagKey,
      distinctId,
    });
    return this.flagsService.isFeatureFlagEnabled(flagKey, distinctId);
  }
}
