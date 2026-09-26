import type { FeatureFlagKey, FlagUser } from "@repo/analytics";

/**
 * Injection token for the Analytics port
 */
export const ANALYTICS_PORT = Symbol("ANALYTICS_PORT");

/**
 * Port for analytics and feature flag operations
 * This interface defines the contract for feature flag checking
 * in the organizations domain
 */
export interface AnalyticsPort {
  /**
   * Check if a feature flag is enabled
   * @param flagKey - The feature flag key to check
   * @param user - The signed-in user the flag is evaluated for
   * @returns Whether the flag is enabled
   */
  isFeatureFlagEnabled(flagKey: FeatureFlagKey, user: FlagUser): Promise<boolean>;
}
