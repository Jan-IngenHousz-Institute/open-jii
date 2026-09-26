import { Injectable, Logger } from "@nestjs/common";

import type { FeatureFlagKey, FlagUser } from "@repo/analytics";
import { flagPersonProperties } from "@repo/analytics";

import { AuthorizationService } from "../../../authorization/authorization.service";
import type { AnalyticsPort } from "../../../protocols/core/ports/analytics.port";
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
    private readonly authorizationService: AuthorizationService,
  ) {}

  /**
   * Check if a feature flag is enabled
   * @param flagKey - The feature flag key to check
   * @param user - The signed-in user, whose email and organization memberships go with the
   * evaluation so a flag can target either
   * @returns Whether the flag is enabled
   */
  async isFeatureFlagEnabled(flagKey: FeatureFlagKey, user: FlagUser): Promise<boolean> {
    // Matches the web client's identity once the user accepts cookies; before that the browser
    // evaluates cookieless, so only 0% and 100% rollouts agree between the two.
    const distinctId = user.email || user.id;
    const organizationIds = await this.authorizationService.listMemberOrganizationIds(user.id);

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
}
