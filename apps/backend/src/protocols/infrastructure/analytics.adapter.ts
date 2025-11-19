import { Injectable } from "@nestjs/common";

import type { FeatureFlagKey } from "@repo/analytics";

import { AnalyticsAdapter as CommonAnalyticsAdapter } from "../../common/modules/analytics/analytics.adapter";
import type { AnalyticsPort } from "../core/ports/analytics.port";

/**
 * Protocol-specific analytics adapter
 * Delegates to the common analytics adapter from the analytics module
 */
@Injectable()
export class AnalyticsAdapter implements AnalyticsPort {
  constructor(private readonly analyticsAdapter: CommonAnalyticsAdapter) {}

  async isFeatureFlagEnabled(flagKey: FeatureFlagKey, distinctId?: string): Promise<boolean> {
    return this.analyticsAdapter.isFeatureFlagEnabled(flagKey, distinctId);
  }
}
