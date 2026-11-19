import type { FeatureFlagKey } from "@repo/analytics";

export const ANALYTICS_PORT = Symbol("METRICS_ANALYTICS_PORT");

/** Feature flags for the metrics reads, which no user makes. */
export interface AnalyticsPort {
  isEnvironmentFeatureFlagEnabled(flagKey: FeatureFlagKey): Promise<boolean>;
}
