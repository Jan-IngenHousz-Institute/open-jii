import { Injectable, Logger } from "@nestjs/common";

import type { FeatureFlagKey, FlagUser } from "@repo/analytics";
import { flagPersonProperties } from "@repo/analytics";

import { AuthorizationService } from "../../../authorization/authorization.service";
import type { AnalyticsPort } from "../../../protocols/core/ports/analytics.port";
import { ErrorCodes } from "../../utils/error-codes";
import { ErrorReporterService } from "./services/errors/error-reporter.service";
import { FlagsService } from "./services/flags/flags.service";

/**
 * Analytics adapter that implements the AnalyticsPort
 * Provides feature flag checking functionality to domains
 */
@Injectable()
export class AnalyticsAdapter implements AnalyticsPort {
  private readonly logger = new Logger(AnalyticsAdapter.name);

  // Every flag check needs the memberships before FlagsService's own cache can answer, and they
  // change rarely, so they are kept as long as a flag result is.
  private static readonly MEMBERSHIP_CACHE_TTL_MS = 60_000;
  private static readonly MEMBERSHIP_CACHE_MAX_ENTRIES = 5_000;
  private readonly membershipCache = new Map<
    string,
    { organizationIds: string[]; expiresAt: number }
  >();

  constructor(
    private readonly flagsService: FlagsService,
    private readonly authorizationService: AuthorizationService,
    private readonly errorReporter: ErrorReporterService,
  ) {}

  /**
   * Check if a feature flag is enabled
   * @param flagKey - The feature flag key to check
   * @param user - The signed-in user, whose email and organization memberships go with the
   * evaluation so a flag can target either
   * @returns Whether the flag is enabled
   */
  async isFeatureFlagEnabled(flagKey: FeatureFlagKey, user: FlagUser): Promise<boolean> {
    // Matches the web client's identity once the user accepts cookies. Before that the browser
    // evaluates cookieless and without the email, so only 0% and 100% rollouts and organization
    // conditions agree between the two.
    const distinctId = user.email || user.id;

    // Unconfigured, FlagsService answers every flag with its default, so the lookup would be wasted.
    const organizationIds = this.flagsService.isInitialized()
      ? await this.memberOrganizationIds(user.id)
      : [];

    this.logger.debug({
      msg: "Checking feature flag",
      operation: "isFeatureFlagEnabled",
      flagKey,
      distinctId,
    });
    return this.flagsService.isFeatureFlagEnabled(
      flagKey,
      distinctId,
      flagPersonProperties({ email: user.email, organizationIds }),
    );
  }

  /**
   * Report an error that points at a bug to error tracking
   */
  reportError(error: unknown, properties: Record<string, unknown>): void {
    this.errorReporter.report(error, properties);
  }

  /**
   * The user's organization memberships, or none when they cannot be read: a flag check must not
   * fail on the lookup, and the web evaluates without them in the same case.
   */
  private async memberOrganizationIds(userId: string): Promise<string[]> {
    const cached = this.membershipCache.get(userId);
    if (cached !== undefined && cached.expiresAt > Date.now()) {
      return cached.organizationIds;
    }

    try {
      const organizationIds = await this.authorizationService.listMemberOrganizationIds(userId);

      if (this.membershipCache.size >= AnalyticsAdapter.MEMBERSHIP_CACHE_MAX_ENTRIES) {
        const oldest = this.membershipCache.keys().next();
        if (!oldest.done) {
          this.membershipCache.delete(oldest.value);
        }
      }
      this.membershipCache.set(userId, {
        organizationIds,
        expiresAt: Date.now() + AnalyticsAdapter.MEMBERSHIP_CACHE_TTL_MS,
      });

      return organizationIds;
    } catch (error) {
      this.logger.warn({
        msg: "Could not read organization memberships for a flag check",
        errorCode: ErrorCodes.FEATURE_FLAG_FAILED,
        operation: "isFeatureFlagEnabled",
        userId,
        error,
      });
      return [];
    }
  }
}
