import { Injectable, Logger } from "@nestjs/common";

import type { FeatureFlagKey } from "@repo/analytics";

import type { AnalyticsPort } from "../../../protocols/core/ports/analytics.port";
import { ErrorReporterService } from "./services/errors/error-reporter.service";
import { FlagsService } from "./services/flags/flags.service";

/**
 * Analytics adapter that implements the AnalyticsPort
 * Provides feature flag checking functionality to domains
 */
@Injectable()
export class AnalyticsAdapter implements AnalyticsPort {
  private readonly logger = new Logger(AnalyticsAdapter.name);

  constructor(
    private readonly flagsService: FlagsService,
    private readonly errorReporter: ErrorReporterService,
  ) {}

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

  /**
   * Report an error that points at a bug to error tracking
   */
  reportError(error: unknown, properties: Record<string, unknown>): void {
    this.errorReporter.report(error, properties);
  }
}
