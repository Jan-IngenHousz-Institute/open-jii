import type { FeatureFlagKey } from "@repo/analytics";

/**
 * Injection token for the Analytics port
 */
export const ANALYTICS_PORT = Symbol("ANALYTICS_PORT");

/**
 * Port for analytics and feature flag operations
 * This interface defines the contract for feature flag checking
 * in the protocols domain
 */
export interface AnalyticsPort {
  /**
   * Check if a feature flag is enabled
   * @param flagKey - The feature flag key to check
   * @param user - The signed-in user; omit to evaluate anonymously
   * @returns Whether the flag is enabled
   */
  isFeatureFlagEnabled(
    flagKey: FeatureFlagKey,
    user?: { id: string; email: string },
  ): Promise<boolean>;
}
