import type { FeatureFlagKey } from "@repo/analytics";

/**
 * Port for analytics and feature flag operations
 * This interface defines the contract for feature flag checking
 * in the protocols domain
 */
export interface AnalyticsPort {
  /**
   * Check if a feature flag is enabled
   * @param flagKey - The feature flag key to check
   * @param distinctId - Optional user identifier
   * @returns Whether the flag is enabled
   */
  isFeatureFlagEnabled(flagKey: FeatureFlagKey, distinctId?: string): Promise<boolean>;
}
