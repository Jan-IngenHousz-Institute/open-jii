import { Injectable, Logger } from "@nestjs/common";

import type { FeatureFlagKey } from "@repo/analytics";
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
   * evaluation so a flag can target either; omit to evaluate anonymously
   * @returns Whether the flag is enabled
   */
  async isFeatureFlagEnabled(
    flagKey: FeatureFlagKey,
    user?: { id: string; email: string },
  ): Promise<boolean> {
    if (!user) {
      this.logger.debug({
        msg: "Checking feature flag",
        operation: "isFeatureFlagEnabled",
        flagKey,
        distinctId: "anonymous",
      });
      return this.flagsService.isFeatureFlagEnabled(flagKey);
    }

    // The web client identifies by email, so both sides evaluate the same person.
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
